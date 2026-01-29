// bridge/server.js
import http from "http";
import { WebSocketServer, WebSocket } from "ws";

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "0.0.0.0";

const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || "").trim();
if (!OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY (fly secrets set OPENAI_API_KEY=...)");
  process.exit(1);
}

const REALTIME_MODEL = (process.env.REALTIME_MODEL || "gpt-realtime").trim();
const REALTIME_VOICE = (process.env.REALTIME_VOICE || "marin").trim();

const OPENAI_REALTIME_URL = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(
  REALTIME_MODEL
)}`;

// Tunables
const MIN_MEDIA_FRAMES = Number(process.env.MIN_MEDIA_FRAMES || 10); // safe default
const SPEECH_STOP_DEBOUNCE_MS = Number(process.env.SPEECH_STOP_DEBOUNCE_MS || 450);
const VAD_SILENCE_MS = Number(process.env.VAD_SILENCE_MS || 700);

// Reconnect tuning
const OPENAI_RECONNECT_MAX = Number(process.env.OPENAI_RECONNECT_MAX || 3);
const OPENAI_RECONNECT_DELAY_MS = Number(process.env.OPENAI_RECONNECT_DELAY_MS || 600);

// Tool calling tuning
const TOOL_CALL_COOLDOWN_MS = Number(process.env.TOOL_CALL_COOLDOWN_MS || 2500);

// Debug (defaults OFF)
const DEBUG_OPENAI_EVENTS = (process.env.DEBUG_OPENAI_EVENTS || "").trim() === "1";
const DEBUG_TWILIO_EVENTS = (process.env.DEBUG_TWILIO_EVENTS || "").trim() === "1";
const DEBUG_OPENAI_TEXT = (process.env.DEBUG_OPENAI_TEXT || "").trim() === "1";

// Anti-spam safety
const RESPONSE_CREATE_MIN_GAP_MS = Number(process.env.RESPONSE_CREATE_MIN_GAP_MS || 350);
const FORCE_SPEAK_MAX_PER_CALL = Number(process.env.FORCE_SPEAK_MAX_PER_CALL || 3);

// Greeting reliability
const GREET_ON_START_DELAY_MS = Number(process.env.GREET_ON_START_DELAY_MS || 250);
const GREET_FORCE_TIMEOUT_MS = Number(process.env.GREET_FORCE_TIMEOUT_MS || 1200);

// responseInFlight watchdog
const RESPONSE_INFLIGHT_TIMEOUT_MS = Number(process.env.RESPONSE_INFLIGHT_TIMEOUT_MS || 8000);

// when user speaks after confirm prompt, execute tool immediately
const EXECUTE_ON_USER_CONFIRM_SPEECH =
  String(process.env.EXECUTE_ON_USER_CONFIRM_SPEECH || "1").trim() !== "0";

// Upstash Redis REST (for writing M16 outcome from Fly)
const UPSTASH_REDIS_REST_URL = (process.env.UPSTASH_REDIS_REST_URL || "")
  .trim()
  .replace(/\/+$/, "");
const UPSTASH_REDIS_REST_TOKEN = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
const M16_OUTCOME_TTL_SECONDS = Number(process.env.M16_OUTCOME_TTL_SECONDS || 60 * 60 * 6); // 6h

// ✅ NEW: commit safety window (prevents stale speech_stopped committing old/empty buffer)
const COMMIT_RECENT_APPEND_MAX_MS = Number(process.env.COMMIT_RECENT_APPEND_MAX_MS || 900);
// ✅ NEW: cooldown after commit_empty so we don’t spam commits
const COMMIT_EMPTY_COOLDOWN_MS = Number(process.env.COMMIT_EMPTY_COOLDOWN_MS || 1500);

function nowIso() {
  return new Date().toISOString();
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function wsSend(ws, obj) {
  if (!ws) return false;
  if (ws.readyState !== WebSocket.OPEN) return false;
  try {
    ws.send(JSON.stringify(obj));
    return true;
  } catch (e) {
    console.log("[bridge] wsSend exception", { error: String(e?.message || e) });
    return false;
  }
}

async function upstashSetJSON(key, obj, ttlSeconds) {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) return { ok: false, skipped: true };

  const safeKey = encodeURIComponent(String(key || ""));
  const url = `${UPSTASH_REDIS_REST_URL}/set/${safeKey}?EX=${encodeURIComponent(
    String(ttlSeconds || M16_OUTCOME_TTL_SECONDS)
  )}`;

  const body = JSON.stringify(obj ?? {});
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      "content-type": "application/json",
    },
    body,
  });

  const text = await r.text().catch(() => "");
  return { ok: r.ok, status: r.status, raw: text.slice(0, 500) };
}

function extractAudioDelta(msg) {
  if (!msg || typeof msg !== "object") return null;

  if (
    (msg.type === "response.audio.delta" || msg.type === "response.output_audio.delta") &&
    msg.delta
  ) return msg.delta;

  if (
    (msg.type === "response.audio.delta" || msg.type === "response.output_audio.delta") &&
    msg.audio?.delta
  ) return msg.audio.delta;

  if (msg.type === "output_audio.delta" && msg.delta) return msg.delta;
  if (msg.type === "output_audio.delta" && msg.output_audio?.delta) return msg.output_audio.delta;

  if (msg.type === "response.output_item.added") {
    const d = msg.item?.content?.[0]?.audio?.delta;
    if (d) return d;
  }

  if (msg.type === "response.output_item.delta") {
    const d = msg.delta?.content?.[0]?.audio?.delta;
    if (d) return d;
  }

  return null;
}

function extractTextDelta(msg) {
  if (!msg || typeof msg !== "object") return null;

  if (msg.type === "response.text.delta" && typeof msg.delta === "string") return msg.delta;
  if (msg.type === "response.output_text.delta" && typeof msg.delta === "string") return msg.delta;

  if (msg.type === "response.output_item.added") {
    const t = msg.item?.content?.[0]?.text;
    if (typeof t === "string") return t;
    if (typeof t?.value === "string") return t.value;
  }

  if (msg.type === "response.output_item.delta") {
    const t = msg.delta?.content?.[0]?.text;
    if (typeof t === "string") return t;
    if (typeof t?.value === "string") return t.value;
  }

  return null;
}

function normalizePhoneForFp(phone) {
  const raw = String(phone || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/[^\d]/g, "");
  return digits.slice(-11);
}

function normalizeToE164Maybe(phoneRaw) {
  const raw = String(phoneRaw || "").trim();
  const digits = raw.replace(/[^\d]/g, "");

  if (!raw) return { ok: false, e164: "", reason: "empty" };
  if (/^\+\d{8,15}$/.test(raw)) return { ok: true, e164: raw, reason: "already_e164" };

  if (digits.length === 10) return { ok: true, e164: `+1${digits}`, reason: "assumed_us_country_code" };
  if (digits.length === 11 && digits.startsWith("1")) return { ok: true, e164: `+${digits}`, reason: "digits_11_us" };

  return { ok: false, e164: "", reason: `invalid_format digits=${digits.length}` };
}

// ✅ FIX: do NOT convert "" -> 0
function toNumMaybe(x) {
  const s = String(x ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function isValidLatLng(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  return true;
}

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, ts: nowIso() }));
    return;
  }
  if (req.url === "/") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("Foundzie Bridge is running");
    return;
  }
  res.writeHead(404);
  res.end("not found");
});

const wss = new WebSocketServer({ server, path: "/twilio/stream" });

wss.on("connection", (twilioWs, req) => {
  console.log("[twilio] ws connected", { url: req?.url });

  let streamSid = null;

  let custom = {
    base: "",
    roomId: "",
    callSid: "",
    from: "",
    source: "",
    role: "caller",
    calleeType: "personal",
    task: "",
    sessionId: "",
    callerCallSid: "",

    locLat: null,
    locLng: null,
    locAcc: null,
    locUpdatedAt: "",
    locLabel: "",
  };

  let openaiWs = null;
  let openaiConnecting = false;
  let openaiReconnects = 0;

  let openaiReady = false;

  // STRICT response gate
  let responseInFlight = false;
  let lastResponseCreateAtMs = 0;
  let responseInFlightTimer = null;

  // Per-response output counters
  let respOutboundAudioFrames = 0;
  let respOutboundTextPieces = 0;

  // Call counters
  let inboundMediaFrames = 0;
  let outboundAudioFramesTotal = 0;

  // Speech tracking (Twilio -> OpenAI)
  let pendingResponseTimer = null;

  // Greeting controls
  let greeted = false;
  let audioWatchdogTimer = null;
  let greetOnStartTimer = null;
  let greetForceTimer = null;

  let forceSpeakCount = 0;
  let queuedForceSpeakReason = null;

  let sessionUpdatedWatchdog = null;

  // Tool buffers
  const toolArgBuffers = new Map();
  const toolCooldownMap = new Map();
  const seenToolKeys = new Set();
  const handledToolCalls = new Set();

  let pendingTool = null;

  // M16 (kept)
  let calleeFlowStarted = false;
  let calleeReplyCaptured = false;
  let calleeAssistantText = "";
  let calleeOutcomeWritten = false;

  // ✅ COMMIT EMPTY FIX (robust, preserves your VAD logic but adds hard gates)
  let awaitingSpeechStart = true;
  let sawSpeechStartedSinceCommit = false;

  // Count ONLY successful audio appends AFTER speech_started
  let speechFramesSinceStarted = 0;

  // Track last successful append time after speech_started (hard gate)
  let lastSpeechAppendAtMs = 0;

  // Prevent multiple commits while one is in flight
  let commitInFlight = false;

  // Rate limit commits
  let lastCommitAtMs = 0;

  // Cooldown after commit_empty from OpenAI
  let commitCooldownUntilMs = 0;

  let closed = false;

  function clearTimer(t) {
    if (t) clearTimeout(t);
    return null;
  }

  function clearInFlight(reason) {
    if (!responseInFlight) return;
    responseInFlight = false;
    responseInFlightTimer = clearTimer(responseInFlightTimer);
    console.log("[bridge] responseInFlight cleared", { reason, at: nowIso() });
  }

  function shutdown(reason) {
    if (closed) return;
    closed = true;

    pendingResponseTimer = clearTimer(pendingResponseTimer);
    audioWatchdogTimer = clearTimer(audioWatchdogTimer);
    greetOnStartTimer = clearTimer(greetOnStartTimer);
    greetForceTimer = clearTimer(greetForceTimer);
    responseInFlightTimer = clearTimer(responseInFlightTimer);
    sessionUpdatedWatchdog = clearTimer(sessionUpdatedWatchdog);

    clearInterval(pingInterval);
    clearInterval(openAiPingInterval);

    console.log("[bridge] shutdown:", reason || "unknown", {
      inboundMediaFrames,
      outboundAudioFramesTotal,
      streamSid,
      callSid: custom.callSid || null,
      roomId: custom.roomId || null,
      role: custom.role || null,
      sessionId: custom.sessionId || null,
      model: REALTIME_MODEL,
      voice: REALTIME_VOICE,
      base: custom.base || null,
      locLat: custom.locLat,
      locLng: custom.locLng,
      locAcc: custom.locAcc,
      locUpdatedAt: custom.locUpdatedAt || null,
      locLabel: custom.locLabel || null,
      openaiReady,

      // commit/vad
      awaitingSpeechStart,
      sawSpeechStartedSinceCommit,
      speechFramesSinceStarted,
      lastSpeechAppendAtMs: lastSpeechAppendAtMs ? new Date(lastSpeechAppendAtMs).toISOString() : null,
      commitInFlight,
      commitCooldownUntilMs: commitCooldownUntilMs ? new Date(commitCooldownUntilMs).toISOString() : null,
    });

    try {
      if (openaiWs && openaiWs.readyState === WebSocket.OPEN) openaiWs.close();
    } catch {}
    try {
      if (twilioWs.readyState === WebSocket.OPEN) twilioWs.close();
    } catch {}
  }

  function getVercelBase() {
    const b =
      (custom.base || "").trim() ||
      (process.env.TWILIO_BASE_URL || "").trim() ||
      (process.env.TWILIO_BASE_URL_FALLBACK || "").trim() ||
      "https://foundzie-v2.vercel.app";
    return b.replace(/\/+$/, "");
  }

  async function hydrateLocationLabelIfPossible() {
    try {
      if (custom.locLabel && custom.locLabel.trim()) return;

      const lat = custom.locLat;
      const lng = custom.locLng;
      if (!isValidLatLng(lat, lng)) return;

      const base = getVercelBase();
      const url = `${base}/api/location/reverse?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(
        String(lng)
      )}`;

      const r = await fetch(url, { method: "GET" });
      const text = await r.text().catch(() => "");

      if (!r.ok) {
        console.log("[bridge] reverse geocode failed", {
          status: r.status,
          url,
          preview: text.slice(0, 250),
        });
        return;
      }

      let j = {};
      try {
        j = text ? JSON.parse(text) : {};
      } catch {
        console.log("[bridge] reverse geocode json parse failed", { url, preview: text.slice(0, 250) });
        return;
      }

      const label = typeof j?.item?.label === "string" ? j.item.label.trim() : "";
      if (label) custom.locLabel = label;
      else console.log("[bridge] reverse geocode ok but no label", { url, preview: JSON.stringify(j).slice(0, 250) });
    } catch (e) {
      console.log("[bridge] reverse geocode exception", { error: String(e?.message || e) });
    }
  }

  function buildLocationLineForPrompt() {
    const lat = custom.locLat;
    const lng = custom.locLng;
    const acc = custom.locAcc;
    const updatedAt = (custom.locUpdatedAt || "").trim();
    const label = (custom.locLabel || "").trim();

    if (label) {
      return `User location: ${label}${acc != null ? ` (accuracy ${acc}m)` : ""}${updatedAt ? `, updatedAt=${updatedAt}` : ""}.`;
    }
    if (isValidLatLng(lat, lng)) {
      return `User location: lat=${lat}, lng=${lng}${acc != null ? ` (accuracy ${acc}m)` : ""}${updatedAt ? `, updatedAt=${updatedAt}` : ""}.`;
    }
    return "";
  }

  function toolKey(name, args) {
    return `${name}::${JSON.stringify(args || {})}`;
  }

  function fingerprintToolCall(name, args = {}) {
    if (!args || typeof args !== "object") return `${name}:noargs`;
    if (name === "call_third_party") {
      const p = normalizePhoneForFp(args.phone);
      const msgs = Array.isArray(args.messages) ? args.messages : [];
      const legacy = String(args.message || "").trim();
      const joined = (msgs.length ? msgs.join(" ") : legacy).slice(0, 64);
      return `${name}:p=${p}:m=${joined}`.replace(/[^a-zA-Z0-9:_=.-]/g, "_");
    }
    const short = JSON.stringify(args).slice(0, 80);
    return `${name}:${short}`.replace(/[^a-zA-Z0-9:_=.-]/g, "_");
  }

  function toolIsCoolingDown(name, args) {
    const fp = fingerprintToolCall(name, args);
    const now = Date.now();
    const last = toolCooldownMap.get(fp) || 0;
    const elapsed = now - last;

    if (elapsed >= 0 && elapsed < TOOL_CALL_COOLDOWN_MS) {
      return { blocked: true, fp, remainingMs: TOOL_CALL_COOLDOWN_MS - elapsed };
    }
    toolCooldownMap.set(fp, now);
    return { blocked: false, fp, remainingMs: 0 };
  }

  function canCreateResponseNow() {
    if (!openaiWs) return false;
    if (openaiWs.readyState !== WebSocket.OPEN) return false;
    if (responseInFlight) return false;
    const now = Date.now();
    if (now - lastResponseCreateAtMs < RESPONSE_CREATE_MIN_GAP_MS) return false;
    return true;
  }

  function explainCreateBlock() {
    const now = Date.now();
    return {
      hasOpenaiWs: !!openaiWs,
      openaiState: openaiWs ? openaiWs.readyState : null,
      responseInFlight,
      msSinceLastCreate: now - lastResponseCreateAtMs,
      minGap: RESPONSE_CREATE_MIN_GAP_MS,
      streamSid,
      role: custom.role,
      at: nowIso(),
      openaiReady,
    };
  }

  function markResponseCreate() {
    responseInFlight = true;
    lastResponseCreateAtMs = Date.now();
    respOutboundAudioFrames = 0;
    respOutboundTextPieces = 0;

    responseInFlightTimer = clearTimer(responseInFlightTimer);
    responseInFlightTimer = setTimeout(() => {
      if (closed) return;
      clearInFlight("timeout_watchdog");
    }, RESPONSE_INFLIGHT_TIMEOUT_MS);
  }

  function createResponse(instructions) {
    if (!canCreateResponseNow()) {
      console.log("[bridge] createResponse blocked", explainCreateBlock());
      return false;
    }

    markResponseCreate();

    const ok = wsSend(openaiWs, {
      type: "response.create",
      response: { modalities: ["audio", "text"], instructions },
    });

    if (!ok) {
      console.log("[bridge] wsSend failed for response.create", explainCreateBlock());
      clearInFlight("wsSend_failed");
    }
    return ok;
  }

  function createUserMessage(text) {
    if (!openaiWs || openaiWs.readyState !== WebSocket.OPEN) return false;
    return wsSend(openaiWs, {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: String(text || "") }],
      },
    });
  }

  function armAudioWatchdog(label) {
    audioWatchdogTimer = clearTimer(audioWatchdogTimer);
    audioWatchdogTimer = setTimeout(() => {
      if (closed) return;
      if (respOutboundAudioFrames > 0) return;
      safeForceSpeak(`audio_watchdog:${label}`);
    }, 1700);
  }

  function safeForceSpeak(reason) {
    if (forceSpeakCount >= FORCE_SPEAK_MAX_PER_CALL) return;

    if (responseInFlight) {
      queuedForceSpeakReason = queuedForceSpeakReason || reason;
      return;
    }

    forceSpeakCount += 1;
    console.log("[bridge] forceSpeakNow:", reason, { count: forceSpeakCount, role: custom.role });

    if (custom.role === "callee") {
      const task = String(custom.task || "").slice(0, 700);
      createResponse(
        `You are calling the recipient on a real phone call. Speak naturally in English. ` +
          `Say the message ONCE exactly as written: "${task}". ` +
          `Then ask: "Do you have a quick reply?"`
      );
    } else {
      createResponse(`Say EXACTLY this, friendly and human: "Hi—this is Foundzie. How can I help?"`);
    }

    armAudioWatchdog("force_speak");
  }

  function scheduleCallerGreeting(reason) {
    if (custom.role !== "caller") return;
    if (greeted) return;
    if (!streamSid) return;

    greetOnStartTimer = clearTimer(greetOnStartTimer);
    greetOnStartTimer = setTimeout(() => {
      if (closed) return;
      if (greeted) return;

      greeted = true;
      console.log("[bridge] greeting triggered", { reason, at: nowIso() });

      const ok = createResponse(`Say EXACTLY this, friendly and human: "Hi—this is Foundzie. How can I help?"`);
      if (!ok) safeForceSpeak("greet_create_blocked");
      armAudioWatchdog("greet");
    }, GREET_ON_START_DELAY_MS);

    greetForceTimer = clearTimer(greetForceTimer);
    greetForceTimer = setTimeout(() => {
      if (closed) return;
      if (respOutboundAudioFrames > 0) return;
      safeForceSpeak("greet_force_timer");
    }, GREET_FORCE_TIMEOUT_MS);
  }

  function buildLegacySessionUpdatePayload() {
    const locLine = buildLocationLineForPrompt();

    const baseInstructionsCaller =
      "You are Foundzie, a lightning-fast personal concierge on a LIVE phone call. " +
      "Speak natural, warm, confident English. Sound human, not robotic. " +
      "Keep replies short: 1–2 sentences. Ask at most ONE follow-up question. " +
      "Do NOT repeat greetings or re-introduce yourself after the call is connected. " +
      "Do NOT say 'Hey this is Foundzie' unless the user asks who you are. " +
      "If the user asks to call/message someone, treat them as the SAME action: place a phone call and deliver the message. " +
      "For personal/multi-message delivery: keep message verbatim and ask for confirmation. " +
      (locLine ? `\n\n${locLine}` : "");

    const baseInstructionsCallee =
      "You are Foundzie calling the RECIPIENT on a REAL phone call. " +
      "SPEAK ENGLISH ONLY. Sound human, polite, and brief. " +
      "Deliver the task exactly once, then ask for a short reply. " +
      "Do NOT mention tools, prompts, or system details.";

    const isCallee = custom.role === "callee";
    const instructions = isCallee ? baseInstructionsCallee : baseInstructionsCaller;

    return {
      modalities: ["audio", "text"],
      input_audio_format: "g711_ulaw",
      output_audio_format: "g711_ulaw",
      turn_detection: { type: "server_vad", silence_duration_ms: VAD_SILENCE_MS },
      voice: REALTIME_VOICE,
      instructions,
      tools: isCallee
        ? []
        : [
            {
              type: "function",
              name: "call_third_party",
              description:
                "Call a third-party phone number and deliver a spoken message. Treat 'call' and 'message' as the same action (phone call + spoken delivery).",
              parameters: {
                type: "object",
                properties: {
                  phone: { type: "string" },
                  message: { type: "string" },
                  messages: { type: "array", items: { type: "string" } },
                  roomId: { type: "string" },
                  callSid: { type: "string" },
                  calleeType: { type: "string" },
                },
                required: ["phone"],
              },
            },
          ],
      tool_choice: isCallee ? "none" : "auto",
    };
  }

  function sendSessionUpdate(ws, reason) {
    const payload = buildLegacySessionUpdatePayload();
    const ok = wsSend(ws, { type: "session.update", session: payload });

    console.log("[bridge] session.update sent", {
      ok,
      reason,
      openaiState: ws ? ws.readyState : null,
      role: custom.role,
      streamSid,
      roomId: custom.roomId || null,
      base: custom.base || null,
      locLabel: custom.locLabel || null,
    });

    return ok;
  }

  function attachOpenAiHandlers(ws) {
    ws.on("open", () => {
      openaiConnecting = false;
      openaiReady = false;

      console.log("[openai] ws open -> session.update", {
        model: REALTIME_MODEL,
        voice: REALTIME_VOICE,
        schema: "legacy-only",
        role: custom.role || "caller",
      });

      sendSessionUpdate(ws, "openai_ws_open");

      sessionUpdatedWatchdog = clearTimer(sessionUpdatedWatchdog);
      sessionUpdatedWatchdog = setTimeout(() => {
        if (closed) return;
        if (respOutboundAudioFrames > 0) return;
        console.log("[bridge] session.updated never arrived -> forcing greeting");
        safeForceSpeak("no_session_updated_watchdog");
      }, 1800);
    });

    ws.on("message", async (data) => {
      const msg = safeJsonParse(data.toString());
      if (!msg) return;

      if (DEBUG_OPENAI_EVENTS) {
        const t = msg.type || "(no-type)";
        if (!String(t).includes("input_audio_buffer.append")) console.log("[openai:event]", t);
      }

      if (msg.type === "error") {
        const code = msg?.error?.code;
        if (code === "input_audio_buffer_commit_empty") {
          console.log("[bridge] openai commit_empty -> cooldown + reset commit gating");
          commitCooldownUntilMs = Date.now() + COMMIT_EMPTY_COOLDOWN_MS;
          commitInFlight = false;

          // reset VAD gates so we require a fresh speech_started
          awaitingSpeechStart = true;
          sawSpeechStartedSinceCommit = false;
          speechFramesSinceStarted = 0;
          lastSpeechAppendAtMs = 0;
        }

        console.error("[openai] error:", JSON.stringify(msg, null, 2));
        return;
      }

      if (msg.type === "session.updated") {
        openaiReady = true;
        console.log("[openai] session.updated -> ready", { role: custom.role, streamSid });
        scheduleCallerGreeting("session.updated");
        return;
      }

      // ✅ OpenAI VAD start/stop signals (we keep them)
      if (msg.type === "input_audio_buffer.speech_started") {
        awaitingSpeechStart = false;
        sawSpeechStartedSinceCommit = true;
        speechFramesSinceStarted = 0;
        lastSpeechAppendAtMs = 0;
        return;
      }

      if (msg.type === "input_audio_buffer.speech_stopped") {
        if (responseInFlight) return;

        // ✅ hard block repeated commits while one is in-flight
        if (commitInFlight) {
          console.log("[bridge] skip commit (commit in flight)", { streamSid });
          return;
        }

        pendingResponseTimer = clearTimer(pendingResponseTimer);
        pendingResponseTimer = setTimeout(() => {
          if (closed) return;
          if (!openaiWs || openaiWs.readyState !== WebSocket.OPEN) return;

          const now = Date.now();
          if (now < commitCooldownUntilMs) {
            console.log("[bridge] skip commit (cooldown active)", {
              streamSid,
              msLeft: commitCooldownUntilMs - now,
            });
            return;
          }

          // ✅ MUST have had a speech_started
          if (awaitingSpeechStart || !sawSpeechStartedSinceCommit) {
            console.log("[bridge] skip commit (no speech_started)", {
              streamSid,
              awaitingSpeechStart,
              sawSpeechStartedSinceCommit,
            });
            return;
          }

          // ✅ MUST have recent successful append after speech_started
          if (!lastSpeechAppendAtMs || now - lastSpeechAppendAtMs > COMMIT_RECENT_APPEND_MAX_MS) {
            console.log("[bridge] skip commit (no recent speech append)", {
              streamSid,
              msSinceLastSpeechAppend: lastSpeechAppendAtMs ? now - lastSpeechAppendAtMs : null,
              speechFramesSinceStarted,
            });

            // reset and wait for next real speech segment
            awaitingSpeechStart = true;
            sawSpeechStartedSinceCommit = false;
            speechFramesSinceStarted = 0;
            lastSpeechAppendAtMs = 0;
            return;
          }

          // ✅ MUST have enough frames during the speech segment
          const minReq = custom.role === "callee" ? 1 : MIN_MEDIA_FRAMES;
          if (speechFramesSinceStarted < minReq) {
            console.log("[bridge] skip commit (speech buffer too small)", {
              streamSid,
              speechFramesSinceStarted,
              minReq,
            });

            // reset and wait for next real speech segment
            awaitingSpeechStart = true;
            sawSpeechStartedSinceCommit = false;
            speechFramesSinceStarted = 0;
            lastSpeechAppendAtMs = 0;
            return;
          }

          // ✅ commit rate limit (avoid double-fire)
          if (now - lastCommitAtMs < 200) {
            console.log("[bridge] skip commit (rate limited)", { streamSid, deltaMs: now - lastCommitAtMs });
            return;
          }
          lastCommitAtMs = now;

          const didCommit = wsSend(openaiWs, { type: "input_audio_buffer.commit" });
          console.log("[bridge] commit sent", { didCommit, streamSid });

          // ✅ lock commits until response.done or commit_empty error
          commitInFlight = true;

          // ✅ after commit, require a fresh speech_started
          awaitingSpeechStart = true;
          sawSpeechStartedSinceCommit = false;
          speechFramesSinceStarted = 0;
          lastSpeechAppendAtMs = 0;

          const ok = createResponse("Reply briefly and warmly in ENGLISH (1–2 sentences). Ask ONE question if needed.");
          if (ok) armAudioWatchdog("post_speech");
        }, SPEECH_STOP_DEBOUNCE_MS);

        return;
      }

      const audioDelta = extractAudioDelta(msg);
      if (audioDelta && streamSid) {
        respOutboundAudioFrames += 1;
        outboundAudioFramesTotal += 1;
        wsSend(twilioWs, { event: "media", streamSid, media: { payload: audioDelta } });
        return;
      }

      const textDelta = extractTextDelta(msg);
      if (textDelta) {
        respOutboundTextPieces += 1;
        const piece = String(textDelta);
        if (DEBUG_OPENAI_TEXT) console.log("[text] delta:", piece.slice(0, 200));
        if (custom.role === "callee") {
          calleeAssistantText += piece;
          if (calleeAssistantText.length > 4000) calleeAssistantText = calleeAssistantText.slice(-4000);
        }
      }

      if (msg.type === "response.created" || msg.type === "response.started") {
        responseInFlight = true;
        return;
      }

      if (
        msg.type === "response.done" ||
        msg.type === "response.completed" ||
        msg.type === "response.stopped"
      ) {
        clearInFlight("response.done");

        // ✅ release commit lock after model finished responding
        commitInFlight = false;

        if (queuedForceSpeakReason) {
          const reason = queuedForceSpeakReason;
          queuedForceSpeakReason = null;
          safeForceSpeak(reason);
        }
        return;
      }

      // tool calling handling unchanged
      if (msg.type === "response.function_call_arguments.delta") {
        if (custom.role === "callee") return;
        const call_id = msg.call_id || msg.callId || msg.id;
        const delta = msg.delta || "";
        if (!call_id) return;
        const prev = toolArgBuffers.get(call_id) || "";
        toolArgBuffers.set(call_id, prev + delta);
        return;
      }

      if (msg.type === "response.function_call_arguments.done") {
        if (custom.role === "callee") return;

        const call_id = msg.call_id || msg.callId || msg.id;
        const name = msg.name || msg.tool_name || msg.function?.name;
        if (!call_id || !name) return;

        if (handledToolCalls.has(call_id)) return;
        handledToolCalls.add(call_id);

        const buf = toolArgBuffers.get(call_id) || "";
        toolArgBuffers.delete(call_id);

        let args = {};
        try { args = buf ? JSON.parse(buf) : {}; } catch { args = {}; }

        const phoneRaw = String(args?.phone || "").trim();
        const messages = Array.isArray(args?.messages) ? args.messages.map((m) => String(m || "").trim()).filter(Boolean) : [];
        const legacyMessage = String(args?.message || "").trim();
        const msgText = messages.length ? messages.join(" ") : legacyMessage;

        if (!phoneRaw || !msgText) return;

        const norm = normalizeToE164Maybe(phoneRaw);
        const normalizedPhone = norm.ok ? norm.e164 : phoneRaw;

        if (!pendingTool) {
          pendingTool = { phone: normalizedPhone, messageText: msgText, askedAtMs: Date.now(), executed: false };
          createUserMessage(`Confirm YES to send this exact message: "${msgText}".`);
          const ok = createResponse(`Ask ONE short question: "Confirm YES to send: '${msgText}' ?" Do not change the message.`);
          if (!ok) queuedForceSpeakReason = queuedForceSpeakReason || "tool_confirm_gate";
          armAudioWatchdog("tool_confirm_gate");
          return;
        }

        return;
      }
    });

    ws.on("close", () => {
      console.log("[openai] closed");
      openaiReady = false;
      openaiConnecting = false;
      clearInFlight("openai_closed");

      if (closed) return;
      if (twilioWs.readyState !== WebSocket.OPEN) return;

      if (openaiReconnects >= OPENAI_RECONNECT_MAX) return;
      openaiReconnects += 1;

      setTimeout(() => {
        if (closed) return;
        if (twilioWs.readyState !== WebSocket.OPEN) return;
        connectOpenAi();
      }, OPENAI_RECONNECT_DELAY_MS);
    });

    ws.on("error", (e) => console.error("[openai] ws error:", e));
  }

  function connectOpenAi() {
    if (closed) return;
    if (openaiConnecting) return;

    openaiConnecting = true;

    openaiWs = new WebSocket(OPENAI_REALTIME_URL, {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "OpenAI-Beta": "realtime=v1",
      },
    });

    attachOpenAiHandlers(openaiWs);
  }

  connectOpenAi();

  const pingInterval = setInterval(() => {
    try { if (twilioWs.readyState === WebSocket.OPEN) twilioWs.ping(); } catch {}
  }, 15000);

  const openAiPingInterval = setInterval(() => {
    try { if (openaiWs && openaiWs.readyState === WebSocket.OPEN) openaiWs.ping(); } catch {}
  }, 20000);

  // Twilio inbound
  twilioWs.on("message", async (data) => {
    const msg = safeJsonParse(data.toString());
    if (!msg) return;

    if (DEBUG_TWILIO_EVENTS) console.log("[twilio:event]", msg.event);

    if (msg.event === "start") {
      streamSid = msg.start?.streamSid || null;

      const cp = msg.start?.customParameters || {};
      const startCallSid = String(msg.start?.callSid || "").trim();
      const startFrom =
        String(msg.start?.from || "").trim() ||
        String(msg.start?.caller || "").trim() ||
        String(msg.start?.callerNumber || "").trim();

      const locLat = toNumMaybe(cp.locLat ?? cp.loclat ?? cp.LocLat ?? cp.LOCLAT);
      const locLng = toNumMaybe(cp.locLng ?? cp.loclng ?? cp.LocLng ?? cp.LOCLNG);
      const locAcc = toNumMaybe(cp.locAcc ?? cp.locacc ?? cp.LocAcc ?? cp.LOCACC);
      const locUpdatedAt = String(
        cp.locUpdatedAt ?? cp.locupdatedat ?? cp.LocUpdatedAt ?? cp.LOCUPDATEDAT ?? ""
      ).trim();

      custom = {
        base: String(cp.base || cp.BASE || "").trim(),
        roomId: String(cp.roomId || cp.roomid || "").trim(),
        callSid: String(cp.callSid || cp.callsid || "").trim() || startCallSid,
        from: String(cp.from || cp.FROM || "").trim() || startFrom,
        source: String(cp.source || "").trim(),
        role: String(cp.role || "caller").trim() || "caller",
        calleeType: String(cp.calleeType || "personal").trim() || "personal",
        task: String(cp.task || "").trim(),
        sessionId: String(cp.sessionId || cp.sid || "").trim(),
        callerCallSid: String(cp.callerCallSid || "").trim(),
        locLat,
        locLng,
        locAcc,
        locUpdatedAt,
        locLabel: "",
      };

      await hydrateLocationLabelIfPossible();

      console.log("[twilio] start", {
        streamSid,
        callSid: custom.callSid || null,
        from: custom.from || null,
        roomId: custom.roomId || null,
        role: custom.role || null,
        sessionId: custom.sessionId || null,
        base: custom.base || null,
        locLabel: custom.locLabel || null,
      });

      // reset gating at start
      awaitingSpeechStart = true;
      sawSpeechStartedSinceCommit = false;
      speechFramesSinceStarted = 0;
      lastSpeechAppendAtMs = 0;
      commitInFlight = false;
      lastCommitAtMs = 0;
      commitCooldownUntilMs = 0;

      if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
        sendSessionUpdate(openaiWs, "twilio_start_resync");
      }

      scheduleCallerGreeting("twilio.start");
      return;
    }

    if (msg.event === "media") {
      const payload = msg.media?.payload;
      if (!payload) return;

      inboundMediaFrames += 1;

      if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
        const ok = wsSend(openaiWs, { type: "input_audio_buffer.append", audio: payload });

        // ✅ Count ONLY if append succeeded, and only after speech_started is active
        if (ok && !awaitingSpeechStart && String(payload).length > 0) {
          speechFramesSinceStarted += 1;
          lastSpeechAppendAtMs = Date.now();
        }
      }
      return;
    }

    if (msg.event === "stop") {
      console.log("[twilio] stop", { role: custom.role, sessionId: custom.sessionId || null });

      // Keep your M16 best-effort write (as before)
      if (custom.role === "callee" && !calleeOutcomeWritten) {
        await upstashSetJSON(
          `foundzie:m16:callee:${String(custom.sessionId || "").trim()}:v1`,
          {
            sessionId: String(custom.sessionId || "").trim(),
            kind: "twilio_stop",
            role: "callee",
            callSid: custom.callSid || null,
            roomId: custom.roomId || null,
            from: custom.from || null,
            callerCallSid: custom.callerCallSid || null,
            calleeType: custom.calleeType || null,
            task: (custom.task || "").slice(0, 900) || null,
            assistantText: calleeAssistantText.slice(0, 2500) || null,
            reply: null,
            stopAt: nowIso(),
            updatedAt: nowIso(),
          },
          M16_OUTCOME_TTL_SECONDS
        ).catch(() => {});
        calleeOutcomeWritten = true;
      }

      shutdown("twilio_stop");
    }
  });

  twilioWs.on("close", () => shutdown("twilio_closed"));
  twilioWs.on("error", (e) => {
    console.error("[twilio] ws error:", e);
    shutdown("twilio_error");
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Bridge listening on http://${HOST}:${PORT}`, {
    model: REALTIME_MODEL,
    voice: REALTIME_VOICE,
    url: OPENAI_REALTIME_URL,
  });
});
