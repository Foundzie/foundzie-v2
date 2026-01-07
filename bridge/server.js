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
const MIN_MEDIA_FRAMES = Number(process.env.MIN_MEDIA_FRAMES || 10);
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

// Upstash Redis REST (for writing M16 outcome from Fly)
const UPSTASH_REDIS_REST_URL = (process.env.UPSTASH_REDIS_REST_URL || "").trim().replace(/\/+$/, "");
const UPSTASH_REDIS_REST_TOKEN = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
const M16_OUTCOME_TTL_SECONDS = Number(process.env.M16_OUTCOME_TTL_SECONDS || 60 * 60 * 6); // 6h

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
  } catch {
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

// --- Realtime audio delta shapes vary by version.
function extractAudioDelta(msg) {
  if (!msg || typeof msg !== "object") return null;

  if (
    (msg.type === "response.audio.delta" || msg.type === "response.output_audio.delta") &&
    msg.delta
  ) {
    return msg.delta;
  }

  if (
    (msg.type === "response.audio.delta" || msg.type === "response.output_audio.delta") &&
    msg.audio?.delta
  ) {
    return msg.audio.delta;
  }

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
  // Strict-ish E.164: + and 8..15 digits
  // Also supports "3312998168" (US 10 digits) -> +13312998168
  const raw = String(phoneRaw || "").trim();
  const digits = raw.replace(/[^\d]/g, "");

  if (!raw) return { ok: false, e164: "", reason: "empty" };

  // Already E.164
  if (/^\+\d{8,15}$/.test(raw)) return { ok: true, e164: raw, reason: "already_e164" };

  // If digits look like US 10 digits, assume +1
  if (digits.length === 10) return { ok: true, e164: `+1${digits}`, reason: "assumed_us_country_code" };

  // If digits look like US 11 with leading 1
  if (digits.length === 11 && digits.startsWith("1")) return { ok: true, e164: `+${digits}`, reason: "digits_11_us" };

  return { ok: false, e164: "", reason: `invalid_format digits=${digits.length}` };
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

// IMPORTANT: Twilio Stream URL must include this path:
const wss = new WebSocketServer({ server, path: "/twilio/stream" });

wss.on("connection", (twilioWs, req) => {
  console.log("[twilio] ws connected", { url: req?.url });

  let streamSid = null;

  // From Twilio start.customParameters (expand for M16)
  let custom = {
    base: "",
    roomId: "",
    callSid: "",
    from: "",
    source: "",
    role: "caller", // caller | callee
    calleeType: "personal", // personal | business
    task: "",
    sessionId: "",
    callerCallSid: "",
  };

  // OpenAI socket + state
  let openaiWs = null;
  let openaiConnecting = false;
  let openaiReconnects = 0;
  let openaiReady = false;

  // STRICT response gate
  let responseInFlight = false;
  let lastResponseCreateAtMs = 0;

  // Per-response output counters
  let respOutboundAudioFrames = 0;
  let respOutboundTextPieces = 0;

  // Call counters
  let inboundMediaFrames = 0;
  let outboundAudioFramesTotal = 0;

  // Speech tracking
  let mediaFramesSinceLastResponse = 0;
  let pendingResponseTimer = null;

  // Greeting/force-speak controls
  let greeted = false;
  let audioWatchdogTimer = null;
  let greetOnStartTimer = null;
  let greetForceTimer = null;

  let forceSpeakCount = 0;
  let queuedForceSpeakReason = null;

  // Tool buffers
  const toolArgBuffers = new Map(); // call_id -> string
  const toolCooldownMap = new Map(); // fp -> lastTimeMs
  const seenToolKeys = new Set(); // exact args, short TTL
  const handledToolCalls = new Set(); // call_id -> true

  // ✅ CONFIRMATION GATE (bridge-controlled)
  // Only execute tool if:
  // 1) we have a pending fingerprint
  // 2) model repeats same request
  // 3) args.confirm === true
  let pendingTool = null; // { fp, phone, messageText, createdAt }

  // M16 callee tracking
  let calleeFlowStarted = false;
  let calleeReplyCaptured = false;
  let calleeAssistantText = "";
  let calleeOutcomeWritten = false;

  let closed = false;

  function clearTimer(t) {
    if (t) clearTimeout(t);
    return null;
  }

  function shutdown(reason) {
    if (closed) return;
    closed = true;

    pendingResponseTimer = clearTimer(pendingResponseTimer);
    audioWatchdogTimer = clearTimer(audioWatchdogTimer);
    greetOnStartTimer = clearTimer(greetOnStartTimer);
    greetForceTimer = clearTimer(greetForceTimer);

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

  // ---------- Response gating helpers ----------
  function canCreateResponseNow() {
    if (!openaiReady || !openaiWs) return false;
    if (openaiWs.readyState !== WebSocket.OPEN) return false;
    if (responseInFlight) return false;
    const now = Date.now();
    if (now - lastResponseCreateAtMs < RESPONSE_CREATE_MIN_GAP_MS) return false;
    return true;
  }

  function explainCreateBlock() {
    const now = Date.now();
    return {
      openaiReady,
      hasOpenaiWs: !!openaiWs,
      openaiState: openaiWs ? openaiWs.readyState : null,
      responseInFlight,
      msSinceLastCreate: now - lastResponseCreateAtMs,
      minGap: RESPONSE_CREATE_MIN_GAP_MS,
      streamSid,
      role: custom.role,
      at: nowIso(),
    };
  }

  function markResponseCreate() {
    responseInFlight = true;
    lastResponseCreateAtMs = Date.now();
    respOutboundAudioFrames = 0;
    respOutboundTextPieces = 0;
  }

  function createResponse(instructions) {
    if (!canCreateResponseNow()) {
      console.log("[bridge] createResponse blocked", explainCreateBlock());
      return false;
    }
    markResponseCreate();
    const ok = wsSend(openaiWs, {
      type: "response.create",
      response: {
        modalities: ["audio", "text"],
        instructions,
      },
    });

    if (!ok) {
      console.log("[bridge] wsSend failed for response.create", explainCreateBlock());
      responseInFlight = false;
    }

    return ok;
  }

  function createUserMessage(text) {
    if (!openaiWs || openaiWs.readyState !== WebSocket.OPEN) {
      if (DEBUG_OPENAI_EVENTS) console.log("[bridge] createUserMessage skipped (ws not open)");
      return false;
    }
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
      if (!openaiReady) return;
      if (respOutboundAudioFrames > 0) return;

      console.log("[bridge] audio watchdog fired:", label);
      safeForceSpeak(`audio_watchdog:${label}`);
    }, 1700);
  }

  function safeForceSpeak(reason) {
    if (!openaiReady || !openaiWs) return;
    if (forceSpeakCount >= FORCE_SPEAK_MAX_PER_CALL) {
      console.log("[bridge] forceSpeak suppressed (max reached)", { reason });
      return;
    }

    if (responseInFlight) {
      queuedForceSpeakReason = queuedForceSpeakReason || reason;
      return;
    }

    forceSpeakCount += 1;
    console.log("[bridge] forceSpeakNow:", reason, { count: forceSpeakCount, role: custom.role });

    if (custom.role === "callee") {
      // IMPORTANT: Callee leg must ONLY deliver task + ask reply.
      createUserMessage("Call connected. Deliver the task now and request a short reply.");
      createResponse(
        `You are calling the recipient. Speak naturally in English. Deliver the task now: "${custom.task}". ` +
          `Then ask for a short reply. Keep it to 1–2 sentences.`
      );
    } else {
      createUserMessage("Call connected. Speak a short greeting now.");
      createResponse("Greet the caller in ONE short sentence, then ask: “How can I help?”");
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
      if (!openaiReady) return;

      greeted = true;
      console.log("[bridge] greeting triggered", { reason, at: nowIso() });

      const ok = createResponse(
        "Speak warmly and naturally in ENGLISH. One short sentence greeting, then ask: “How can I help?”"
      );
      if (!ok) {
        safeForceSpeak("greet_create_blocked");
      }
      armAudioWatchdog("greet");
    }, GREET_ON_START_DELAY_MS);

    greetForceTimer = clearTimer(greetForceTimer);
    greetForceTimer = setTimeout(() => {
      if (closed) return;
      if (!openaiReady) return;
      if (respOutboundAudioFrames > 0) return;
      console.log("[bridge] greetForceTimer fired", { reason, at: nowIso() });
      safeForceSpeak("greet_force_timer");
    }, GREET_FORCE_TIMEOUT_MS);
  }

  // ---------- Tools (caller leg only) ----------
  async function runToolCall(name, args) {
    if (name !== "call_third_party") {
      return { ok: false, message: `Unknown tool: ${name}` };
    }

    // HARD BLOCK: NEVER run tools on callee leg
    if (custom.role === "callee") {
      return { ok: false, blocked: "role_callee_tools_disabled" };
    }

    const phoneRaw = String(args?.phone || "").trim();

    const messages = Array.isArray(args?.messages)
      ? args.messages.map((m) => String(m || "").trim()).filter(Boolean)
      : [];
    const legacyMessage = String(args?.message || "").trim();
    const hasMessages = messages.length > 0;
    const message = hasMessages ? messages.join(" ") : legacyMessage;

    if (!phoneRaw || !message) {
      console.log("[tool] missing args; skipping execution", {
        phone: !!phoneRaw,
        message: !!message,
        messagesCount: messages.length,
      });
      return { ok: false, blocked: "missing_args", need: ["phone", "message or messages[]"] };
    }

    // Normalize phone
    const norm = normalizeToE164Maybe(phoneRaw);
    if (!norm.ok) {
      console.log("[tool] blocked invalid phone format", { phoneRaw, reason: norm.reason });
      return {
        ok: false,
        blocked: "invalid_phone",
        phoneRaw,
        reason: norm.reason,
        hint: "Use E.164 like +13312998168",
      };
    }

    const phone = norm.e164;

    const cd = toolIsCoolingDown(name, { ...args, phone });
    if (cd.blocked) {
      console.log("[tool] blocked by cooldown", { name, fp: cd.fp, remainingMs: cd.remainingMs });
      return { ok: false, blocked: "cooldown", remainingMs: cd.remainingMs, fingerprint: cd.fp };
    }

    const k = toolKey(name, { ...args, phone });
    if (seenToolKeys.has(k)) {
      console.log("[tool] blocked duplicate", { name });
      return { ok: false, blocked: "duplicate" };
    }
    seenToolKeys.add(k);
    setTimeout(() => seenToolKeys.delete(k), 12000);

    const base = getVercelBase();
    const url = `${base}/api/tools/call_third_party`;

    const payload = {
      ...(args || {}),
      phone,
      roomId: (args?.roomId || custom.roomId || "").toString() || "current",
      callSid: (args?.callSid || custom.callSid || "").toString() || "current",
      calleeType: (args?.calleeType || "personal").toString(),
      messages: hasMessages ? messages : undefined,
      message: hasMessages ? messages.join(" ") : legacyMessage,
      confirm: !!args?.confirm,
    };

    console.log("[tool] calling backend", { url, payload });

    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await r.text().catch(() => "");
      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = { ok: r.ok, status: r.status, raw: text.slice(0, 1200) };
      }

      // IMPORTANT: log response so you can see why “no call happened”
      console.log("[tool] backend response", {
        ok: r.ok,
        status: r.status,
        preview: (typeof data === "object" ? JSON.stringify(data) : String(data)).slice(0, 400),
      });

      return { ok: r.ok, status: r.status, data };
    } catch (e) {
      console.error("[tool] backend fetch error", e);
      return { ok: false, error: String(e?.message || e) };
    }
  }

  function sendToolResultToOpenAI(call_id, resultObj, originalArgs) {
    wsSend(openaiWs, {
      type: "conversation.item.create",
      item: { type: "function_call_output", call_id, output: JSON.stringify(resultObj || {}) },
    });

    // Callee leg: DO NOT do followup chatter about tools. It contaminates the message delivery.
    if (custom.role === "callee") return;

    if (resultObj?.blocked === "invalid_phone") {
      createUserMessage(
        `The phone number looked invalid: "${resultObj.phoneRaw}". Ask the user for the correct E.164 number (example: +13312998168).`
      );
      const ok = createResponse(
        "Ask ONE short question to confirm the correct phone number in E.164 format."
      );
      if (!ok) queuedForceSpeakReason = queuedForceSpeakReason || "tool_invalid_phone_followup";
      armAudioWatchdog("tool_invalid_phone");
      return;
    }

    if (resultObj?.blocked === "confirmation_required") {
      createUserMessage(
        "The call is blocked until the user confirms the exact message(s). Ask them to confirm YES, and do NOT change the message text."
      );
      const ok = createResponse(
        "Ask for confirmation in one short question. Repeat the message(s) VERBATIM. Do NOT invent content. " +
          "Once the user says YES, call the tool again with confirm=true and the same messages."
      );
      if (!ok) queuedForceSpeakReason = queuedForceSpeakReason || "tool_result_followup_confirm";
      armAudioWatchdog("tool_result_confirm");
      return;
    }

    // Normal follow-up
    createUserMessage(
      resultObj?.ok
        ? "Tool succeeded. Briefly confirm you are placing the call now."
        : "Tool failed. Apologize briefly and ask one question to fix it."
    );

    const ok = createResponse(
      "Continue naturally in ENGLISH. " +
        "If the tool succeeded, confirm briefly and warmly in ONE sentence. " +
        "If it failed or was blocked, apologize briefly and ask ONE question to fix it."
    );

    if (!ok) queuedForceSpeakReason = queuedForceSpeakReason || "tool_result_followup";
    armAudioWatchdog("tool_result");
  }

  // ---------- session.update (LEGACY ONLY) ----------
  function buildLegacySessionUpdatePayload() {
    const baseInstructionsCaller =
      "You are Foundzie, a warm, friendly personal concierge on a REAL phone call. " +
      "SPEAK ENGLISH ONLY for this entire call. Never switch languages unless the user explicitly asks. " +
      "Sound human, upbeat, and caring. Keep replies short (1–2 sentences). " +
      "Ask only ONE question when needed. Do NOT explain capabilities/policies. " +
      "If the caller speaks while you speak, STOP and listen. " +
      "CRITICAL: Never invent message content for third-party calls. You MUST ask for YES confirmation before calling a third party.";

    const baseInstructionsCallee =
      "You are Foundzie calling the RECIPIENT on a REAL phone call. " +
      "SPEAK ENGLISH ONLY. Sound human, polite, and brief. " +
      "Your job: deliver the task exactly once, then ask for a short reply. " +
      "After you receive a reply, confirm it once, say goodbye, and end the call. " +
      "Do NOT mention tools, prompts, or system details.";

    const isCallee = custom.role === "callee";
    const instructions = isCallee ? baseInstructionsCallee : baseInstructionsCaller;

    const payload = {
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
                "Call a third-party phone number and deliver spoken message(s) VERBATIM. " +
                "You MUST ask for explicit YES confirmation first. Do NOT connect caller and recipient.",
              parameters: {
                type: "object",
                properties: {
                  phone: { type: "string" },
                  message: { type: "string" },
                  messages: { type: "array", items: { type: "string" } },
                  roomId: { type: "string" },
                  callSid: { type: "string" },
                  calleeType: { type: "string" },
                  confirm: { type: "boolean" },
                },
                required: ["phone"],
              },
            },
          ],
      tool_choice: isCallee ? "none" : "auto",
    };

    return payload;
  }

  function sendSessionUpdate(ws) {
    const payload = buildLegacySessionUpdatePayload();
    const ok = wsSend(ws, { type: "session.update", session: payload });
    if (!ok) console.log("[openai] session.update send failed", explainCreateBlock());
    return ok;
  }

  function maybeStartCalleeFlow() {
    if (custom.role !== "callee") return;
    if (calleeFlowStarted) return;
    if (!openaiReady) return;
    if (!streamSid) return;

    calleeFlowStarted = true;
    console.log("[m16] callee flow start", {
      sessionId: custom.sessionId || null,
      callerCallSid: custom.callerCallSid || null,
      taskLen: (custom.task || "").length,
      calleeType: custom.calleeType || null,
      callSid: custom.callSid || null,
      from: custom.from || null,
    });

    const task = (custom.task || "").trim();
    const safeTask = task.slice(0, 700);

    const ok = createResponse(
      `Speak naturally in English. You are calling the recipient. ` +
        `Deliver this task ONCE exactly as written: "${safeTask}". ` +
        `Then ask: "Do you have a quick reply?" Keep it short (1–2 sentences).`
    );

    if (!ok) safeForceSpeak("callee_start_blocked");
    armAudioWatchdog("callee_start");
  }

  async function writeM16Outcome(kind, data) {
    const sessionId = (custom.sessionId || "").trim();
    if (!sessionId) return;

    const key = `foundzie:m16:callee:${sessionId}:v1`;
    const payload = {
      sessionId,
      kind,
      role: "callee",
      callSid: custom.callSid || null,
      roomId: custom.roomId || null,
      from: custom.from || null,
      callerCallSid: custom.callerCallSid || null,
      calleeType: custom.calleeType || null,
      task: (custom.task || "").slice(0, 900) || null,
      assistantText: calleeAssistantText.slice(0, 2500) || null,
      ...data,
      updatedAt: nowIso(),
    };

    const r = await upstashSetJSON(key, payload, M16_OUTCOME_TTL_SECONDS).catch((e) => ({
      ok: false,
      error: String(e?.message || e),
    }));

    calleeOutcomeWritten = !!r?.ok;
    console.log("[m16] outcome write", { ok: !!r?.ok, status: r?.status, key, sessionId });
  }

  function tryParseReplyFromAssistantText(text) {
    const t = String(text || "");
    const m1 = t.match(/reply\s*[:\-]\s*([^\n.]{1,120})/i);
    if (m1 && m1[1]) return m1[1].trim();

    const m2 = t.match(/they (?:said|replied)\s*[:\-]?\s*([^\n.]{1,120})/i);
    if (m2 && m2[1]) return m2[1].trim();

    return "";
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

      sendSessionUpdate(ws);
    });

    ws.on("message", async (data) => {
      const msg = safeJsonParse(data.toString());
      if (!msg) return;

      if (DEBUG_OPENAI_EVENTS) {
        const t = msg.type || "(no-type)";
        if (!String(t).includes("input_audio_buffer.append")) console.log("[openai:event]", t);
      }

      if (msg.type === "error") {
        console.error("[openai] error:", JSON.stringify(msg, null, 2));
        return;
      }

      if (msg.type === "session.updated") {
        openaiReady = true;
        console.log("[openai] session.updated -> ready", {
          schemaChosen: "legacy-only",
          role: custom.role,
          streamSid,
        });

        if (custom.role === "callee") {
          maybeStartCalleeFlow();
        } else {
          scheduleCallerGreeting("session.updated");
        }
        return;
      }

      // Audio from OpenAI -> Twilio
      const audioDelta = extractAudioDelta(msg);
      if (audioDelta && streamSid) {
        respOutboundAudioFrames += 1;
        outboundAudioFramesTotal += 1;
        wsSend(twilioWs, { event: "media", streamSid, media: { payload: audioDelta } });
        return;
      }

      // Text deltas
      const textDelta = extractTextDelta(msg);
      if (textDelta) {
        respOutboundTextPieces += 1;
        const piece = String(textDelta);
        if (custom.role === "callee") {
          calleeAssistantText += piece;
          if (calleeAssistantText.length > 4000) calleeAssistantText = calleeAssistantText.slice(-4000);
        }
        if (DEBUG_OPENAI_TEXT) console.log("[text] delta:", piece.slice(0, 200));
      }

      if (msg.type === "response.created" || msg.type === "response.started") {
        responseInFlight = true;
        return;
      }

      if (msg.type === "response.done" || msg.type === "response.completed" || msg.type === "response.stopped") {
        responseInFlight = false;

        if (custom.role === "callee" && calleeReplyCaptured) {
          const reply = tryParseReplyFromAssistantText(calleeAssistantText);
          await writeM16Outcome("callee_complete", {
            reply: reply || null,
            doneAt: nowIso(),
          });

          shutdown("m16_callee_complete");
          return;
        }

        mediaFramesSinceLastResponse = 0;
        pendingResponseTimer = clearTimer(pendingResponseTimer);

        if (queuedForceSpeakReason) {
          const reason = queuedForceSpeakReason;
          queuedForceSpeakReason = null;
          safeForceSpeak(reason);
        }
        return;
      }

      // Speech stopped -> respond (debounced)
      if (msg.type === "input_audio_buffer.speech_stopped") {
        if (responseInFlight) return;

        const minFramesRequired = custom.role === "callee" ? 1 : MIN_MEDIA_FRAMES;
        if (mediaFramesSinceLastResponse < minFramesRequired) return;

        pendingResponseTimer = clearTimer(pendingResponseTimer);
        pendingResponseTimer = setTimeout(() => {
          if (closed) return;
          if (!openaiReady) return;
          if (responseInFlight) return;

          const minReq = custom.role === "callee" ? 1 : MIN_MEDIA_FRAMES;
          if (mediaFramesSinceLastResponse < minReq) return;

          wsSend(openaiWs, { type: "input_audio_buffer.commit" });

          if (custom.role === "callee") {
            calleeReplyCaptured = true;

            const ok = createResponse(
              `You just heard the recipient's reply. ` +
                `Respond with: "Thanks — I’ll pass that along. Goodbye." ` +
                `Also include a short text-only marker like "Reply: <their reply>" in your TEXT output. ` +
                `Keep spoken audio to one short sentence.`
            );
            if (ok) armAudioWatchdog("callee_post_reply");
            return;
          }

          const ok = createResponse(
            "Reply briefly and warmly in ENGLISH (1–2 sentences). Ask ONE question if needed."
          );
          if (ok) armAudioWatchdog("post_speech");
        }, SPEECH_STOP_DEBOUNCE_MS);

        return;
      }

      // Tool calling: delta args (buffer only)
      if (msg.type === "response.function_call_arguments.delta") {
        // HARD IGNORE on callee leg
        if (custom.role === "callee") return;

        const call_id = msg.call_id || msg.callId || msg.id;
        const delta = msg.delta || "";
        if (!call_id) return;
        const prev = toolArgBuffers.get(call_id) || "";
        toolArgBuffers.set(call_id, prev + delta);
        return;
      }

      // Tool calling: done
      if (msg.type === "response.function_call_arguments.done") {
        // HARD IGNORE on callee leg
        if (custom.role === "callee") return;

        const call_id = msg.call_id || msg.callId || msg.id;
        const name = msg.name || msg.tool_name || msg.function?.name;
        if (!call_id || !name) return;

        if (handledToolCalls.has(call_id)) {
          console.log("[tool] duplicate done ignored", { callId: call_id, name });
          return;
        }

        const buf = toolArgBuffers.get(call_id) || "";
        toolArgBuffers.delete(call_id);

        let args = {};
        try {
          args = buf ? JSON.parse(buf) : {};
        } catch {
          args = {};
        }

        // Normalize message(s)
        const messages = Array.isArray(args?.messages)
          ? args.messages.map((m) => String(m || "").trim()).filter(Boolean)
          : [];
        const legacyMessage = String(args?.message || "").trim();
        const hasAnyMessage = messages.length > 0 || !!legacyMessage;

        const phoneRaw = String(args?.phone || "").trim();
        if (!phoneRaw || !hasAnyMessage) {
          console.log("[tool] done with empty args ignored", { name, callId: call_id, args });
          return;
        }

        handledToolCalls.add(call_id);

        // Bridge-controlled confirmation gate
        const norm = normalizeToE164Maybe(phoneRaw);
        const normalizedPhone = norm.ok ? norm.e164 : phoneRaw;

        const msgText = messages.length ? messages.join(" ") : legacyMessage;
        const fp = fingerprintToolCall(name, { phone: normalizedPhone, message: msgText });

        // If we don't yet have a pending tool request, require confirmation step first.
        if (!pendingTool || pendingTool.fp !== fp) {
          pendingTool = { fp, phone: normalizedPhone, messageText: msgText, createdAt: Date.now() };

          console.log("[tool] pending confirmation set", {
            fp,
            phone: normalizedPhone,
            messagePreview: msgText.slice(0, 120),
          });

          createUserMessage(
            `Before I call, please confirm YES to send this exact message: "${msgText}".`
          );
          const ok = createResponse(
            `Ask ONE short question: "Confirm YES to send this exact message: '${msgText}' ?" ` +
              `Do not change the message text.`
          );
          if (!ok) queuedForceSpeakReason = queuedForceSpeakReason || "tool_confirm_gate";
          armAudioWatchdog("tool_confirm_gate");
          return;
        }

        // Must include confirm:true for execution
        if (args?.confirm !== true) {
          console.log("[tool] blocked - confirm flag missing/false", { fp });
          createUserMessage(
            `I still need confirmation. Please say YES to send: "${pendingTool.messageText}".`
          );
          const ok = createResponse("Ask for YES in one short question. Repeat the message verbatim.");
          if (!ok) queuedForceSpeakReason = queuedForceSpeakReason || "tool_confirm_missing";
          armAudioWatchdog("tool_confirm_missing");
          return;
        }

        // Confirmed: execute
        console.log("[tool] received CONFIRMED", { name, callId: call_id, args, at: nowIso() });

        const result = await runToolCall(name, args);
        sendToolResultToOpenAI(call_id, result, args);

        // Clear pending tool after attempt (so next tool requires fresh confirm)
        pendingTool = null;
        return;
      }
    });

    ws.on("close", () => {
      console.log("[openai] closed");
      openaiReady = false;
      openaiConnecting = false;
      responseInFlight = false;

      if (closed) return;
      if (twilioWs.readyState !== WebSocket.OPEN) return;

      if (openaiReconnects >= OPENAI_RECONNECT_MAX) {
        console.error("[openai] reconnect limit reached; keeping Twilio alive but no AI");
        return;
      }

      openaiReconnects += 1;
      console.log(`[openai] reconnecting... (${openaiReconnects}/${OPENAI_RECONNECT_MAX})`);

      setTimeout(() => {
        if (closed) return;
        if (twilioWs.readyState !== WebSocket.OPEN) return;
        connectOpenAi();
      }, OPENAI_RECONNECT_DELAY_MS);
    });

    ws.on("error", (e) => {
      console.error("[openai] ws error:", e);
    });
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
    try {
      if (twilioWs.readyState === WebSocket.OPEN) twilioWs.ping();
    } catch {}
  }, 15000);

  const openAiPingInterval = setInterval(() => {
    try {
      if (openaiWs && openaiWs.readyState === WebSocket.OPEN) openaiWs.ping();
    } catch {}
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
      };

      console.log("[twilio] start", {
        streamSid,
        callSid: custom.callSid || null,
        from: custom.from || null,
        roomId: custom.roomId || null,
        role: custom.role || null,
        sessionId: custom.sessionId || null,
      });

      if (openaiReady) {
        if (custom.role === "callee") maybeStartCalleeFlow();
        else scheduleCallerGreeting("twilio.start");
      } else {
        scheduleCallerGreeting("twilio.start_waiting_for_openai");
      }

      return;
    }

    if (msg.event === "media") {
      const payload = msg.media?.payload;
      if (!payload) return;

      inboundMediaFrames += 1;
      if (!openaiReady) return;

      mediaFramesSinceLastResponse += 1;
      wsSend(openaiWs, { type: "input_audio_buffer.append", audio: payload });
      return;
    }

    if (msg.event === "stop") {
      console.log("[twilio] stop", { role: custom.role, sessionId: custom.sessionId || null });

      if (custom.role === "callee" && !calleeOutcomeWritten) {
        const reply = tryParseReplyFromAssistantText(calleeAssistantText);
        await writeM16Outcome("twilio_stop", {
          reply: reply || null,
          stopAt: nowIso(),
          note: "Stream stopped before response.done; wrote best-effort outcome.",
        });
      }

      shutdown("twilio_stop");
    }
  });

  twilioWs.on("close", () => {
    console.log("[twilio] closed");
    shutdown("twilio_closed");
  });

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
