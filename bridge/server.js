import http from "http";
import { WebSocketServer, WebSocket } from "ws";

/**
 * Foundzie Twilio <Connect><Stream> bridge (Fly.io)
 * - Receives Twilio Media Streams (g711_ulaw)
 * - Sends audio to OpenAI Realtime
 * - Sends audio back to Twilio
 *
 * Supports BOTH Realtime session schemas:
 * - Legacy: session.voice
 * - Newer: session.audio.output.voice
 *
 * Defaults:
 * - REALTIME_MODEL=gpt-realtime
 * - REALTIME_VOICE=marin
 */

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "0.0.0.0";

const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || "").trim();
if (!OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY (fly secrets set OPENAI_API_KEY=...)");
  process.exit(1);
}

// ✅ Default to gpt-realtime + marin (overridable via Fly secrets)
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

/**
 * Realtime audio delta shapes vary by version.
 */
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

// --- diagnostics ---
const diag = {
  startedAt: nowIso(),
  model: REALTIME_MODEL,
  voice: REALTIME_VOICE,

  lastTwilioStartAt: null,
  lastTwilioMediaAt: null,

  lastOpenAiOpenAt: null,
  lastOpenAiSessionUpdatedAt: null,
  lastOpenAiErrorAt: null,
  lastOpenAiError: null,

  lastOutboundAudioAt: null,
  lastInboundAudioAt: null,

  lastOutboundTextAt: null,
  lastOutboundTextSample: null,

  lastResponseDoneAt: null,
  lastResponseDoneSample: null,
  responseDoneNoOutputCount: 0,

  counters: {
    twilioMediaFrames: 0,
    twilioConnections: 0,
    openaiConnections: 0,
    openaiAudioDeltas: 0,
    openaiTextDeltas: 0,
    openaiResponseCreates: 0,
    openaiResponseDones: 0,
    openaiActiveResponseErrors: 0,
  },
};

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, ts: nowIso() }));
    return;
  }

  if (req.url === "/diag") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, ts: nowIso(), ...diag }, null, 2));
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
  diag.counters.twilioConnections += 1;
  console.log("[twilio] ws connected", { url: req?.url });

  let streamSid = null;

  // From Twilio start.customParameters
  let custom = { base: "", roomId: "", callSid: "", from: "", source: "" };

  // OpenAI socket + state
  let openaiWs = null;
  let openaiConnecting = false;
  let openaiReconnects = 0;
  let openaiReady = false;

  // STRICT response gate
  let responseInFlight = false;
  let lastResponseCreateAtMs = 0;

  // Per-response output counters (used to detect silent response)
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
  let greetingRetryTimer = null;
  let forceSpeakCount = 0;
  let queuedForceSpeakReason = null;

  // Tool buffers
  const toolArgBuffers = new Map(); // call_id -> string
  const toolCooldownMap = new Map(); // fp -> lastTimeMs
  const seenToolKeys = new Set(); // exact args, short TTL

  let closed = false;

  // Session schema fallback:
  // - try "new" schema first (audio.output.voice)
  // - if OpenAI errors, fallback to "legacy" schema (voice)
  let sessionSchema = (process.env.REALTIME_SESSION_SCHEMA || "auto").trim(); // auto|new|legacy
  let schemaChosen = null; // "new" | "legacy"
  let schemaTriedNew = false;
  let schemaTriedLegacy = false;

  function clearTimer(t) {
    if (t) clearTimeout(t);
    return null;
  }

  function shutdown(reason) {
    if (closed) return;
    closed = true;

    pendingResponseTimer = clearTimer(pendingResponseTimer);
    audioWatchdogTimer = clearTimer(audioWatchdogTimer);
    greetingRetryTimer = clearTimer(greetingRetryTimer);

    clearInterval(pingInterval);

    console.log("[bridge] shutdown:", reason || "unknown", {
      inboundMediaFrames,
      outboundAudioFramesTotal,
      streamSid,
      callSid: custom.callSid || null,
      roomId: custom.roomId || null,
      model: REALTIME_MODEL,
      voice: REALTIME_VOICE,
      schema: schemaChosen || sessionSchema,
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

  function normalizePhoneForFp(phone) {
    const raw = String(phone || "").trim();
    if (!raw) return "";
    const digits = raw.replace(/[^\d]/g, "");
    return digits.slice(-11);
  }

  function fingerprintToolCall(name, args = {}) {
    if (!args || typeof args !== "object") return `${name}:noargs`;

    if (name === "call_third_party") {
      const p = normalizePhoneForFp(args.phone);
      const m = String(args.message || "").trim().slice(0, 32);
      return `${name}:p=${p}:m=${m}`.replace(/[^a-zA-Z0-9:_=.-]/g, "_");
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
    if (responseInFlight) return false;
    const now = Date.now();
    if (now - lastResponseCreateAtMs < RESPONSE_CREATE_MIN_GAP_MS) return false;
    return true;
  }

  function markResponseCreate() {
    responseInFlight = true;
    lastResponseCreateAtMs = Date.now();
    respOutboundAudioFrames = 0;
    respOutboundTextPieces = 0;
    diag.counters.openaiResponseCreates += 1;
  }

  function markResponseDone(msg) {
    responseInFlight = false;
    diag.counters.openaiResponseDones += 1;
    diag.lastResponseDoneAt = nowIso();
    diag.lastResponseDoneSample = msg;

    if (respOutboundAudioFrames === 0 && respOutboundTextPieces === 0) {
      diag.responseDoneNoOutputCount += 1;
    }

    if (queuedForceSpeakReason) {
      const reason = queuedForceSpeakReason;
      queuedForceSpeakReason = null;
      safeForceSpeak(reason);
    }
  }

  function createResponse(instructions) {
    if (!canCreateResponseNow()) return false;
    markResponseCreate();
    return wsSend(openaiWs, {
      type: "response.create",
      response: {
        modalities: ["audio", "text"],
        instructions,
      },
    });
  }

  function createUserMessage(text) {
    return wsSend(openaiWs, {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: String(text || "") }],
      },
    });
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
    console.log("[bridge] forceSpeakNow:", reason, { count: forceSpeakCount });

    createUserMessage("Call connected. Speak a short greeting now.");
    createResponse("Greet the caller in ONE short sentence, then ask: “How can I help?”");
    armAudioWatchdog("force_speak");
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

  function tryGreet() {
    if (greeted) return;
    if (!openaiReady) return;
    if (!streamSid) return;

    greeted = true;
    console.log("[bridge] greeting triggered");

    const ok = createResponse(
      "Speak warmly and naturally in ENGLISH. One short sentence greeting, then ask: “How can I help?”"
    );

    if (!ok) {
      safeForceSpeak("greet_create_blocked");
      return;
    }

    armAudioWatchdog("greet");

    greetingRetryTimer = clearTimer(greetingRetryTimer);
    greetingRetryTimer = setTimeout(() => {
      if (closed) return;
      if (!openaiReady) return;
      if (respOutboundAudioFrames > 0) return;

      console.log("[bridge] greeting retry: still no outbound audio deltas observed");
      safeForceSpeak("greeting_retry_no_audio");
    }, 2600);
  }

  // Keepalive ping (Twilio only)
  const pingInterval = setInterval(() => {
    try {
      if (twilioWs.readyState === WebSocket.OPEN) twilioWs.ping();
    } catch {}
  }, 15000);

  async function runToolCall(name, args) {
    if (name !== "call_third_party") {
      return { ok: false, message: `Unknown tool: ${name}` };
    }

    const phone = String(args?.phone || "").trim();
    const message = String(args?.message || "").trim();
    if (!phone || !message) {
      console.log("[tool] missing args; skipping execution", { phone: !!phone, message: !!message });
      return { ok: false, blocked: "missing_args", need: ["phone", "message"] };
    }

    const cd = toolIsCoolingDown(name, args);
    if (cd.blocked) {
      console.log("[tool] blocked by cooldown", { name, fp: cd.fp, remainingMs: cd.remainingMs });
      return { ok: false, blocked: "cooldown", remainingMs: cd.remainingMs, fingerprint: cd.fp };
    }

    const k = toolKey(name, args);
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
      roomId: (args?.roomId || custom.roomId || "").toString() || "current",
      callSid: (args?.callSid || custom.callSid || "").toString() || "current",
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

      return { ok: r.ok, status: r.status, data };
    } catch (e) {
      console.error("[tool] backend fetch error", e);
      return { ok: false, error: String(e?.message || e) };
    }
  }

  function sendToolResultToOpenAI(call_id, resultObj) {
    wsSend(openaiWs, {
      type: "conversation.item.create",
      item: { type: "function_call_output", call_id, output: JSON.stringify(resultObj || {}) },
    });

    const ok = createResponse(
      "Continue naturally in ENGLISH. " +
        "If the tool succeeded, confirm briefly and warmly in one sentence. " +
        "If it failed or was blocked, apologize briefly and ask ONE question to fix it."
    );

    if (!ok) queuedForceSpeakReason = queuedForceSpeakReason || "tool_result_followup";
    armAudioWatchdog("tool_result");
  }

  function maybeCancelForBargeIn() {
    if (!openaiWs) return;
    if (respOutboundAudioFrames <= 0) return;

    wsSend(openaiWs, { type: "response.cancel" });
    responseInFlight = false;
    pendingResponseTimer = clearTimer(pendingResponseTimer);
  }

  // ---------- session.update (dual-schema) ----------

  function buildSessionUpdatePayload(schema /* "new" | "legacy" */) {
    const baseSession = {
      modalities: ["audio", "text"],
      input_audio_format: "g711_ulaw",
      output_audio_format: "g711_ulaw",
      turn_detection: { type: "server_vad", silence_duration_ms: VAD_SILENCE_MS },

      instructions:
        "You are Foundzie, a warm, friendly personal concierge on a REAL phone call. " +
        "SPEAK ENGLISH ONLY for this entire call. Never switch languages unless the user explicitly asks. " +
        "Sound human, upbeat, and caring. " +
        "Keep replies short (1–2 sentences). Ask only ONE question when needed. " +
        "Do NOT explain capabilities/policies. Do not mention being an AI unless asked. " +
        "When you say you are delivering a message, say it ONCE only (never repeat filler). " +
        "If the caller speaks while you speak, STOP and listen.",

      tools: [
        {
          type: "function",
          name: "call_third_party",
          description:
            "Call a third-party phone number and deliver a short spoken message. Do NOT connect the caller and recipient together. After delivery, return the outcome.",
          parameters: {
            type: "object",
            properties: {
              phone: { type: "string" },
              message: { type: "string" },
              roomId: { type: "string" },
              callSid: { type: "string" },
            },
            required: ["phone", "message"],
          },
        },
      ],
      tool_choice: "auto",
    };

    if (schema === "new") {
      // Newer schema: session.audio.output.voice
      return {
        ...baseSession,
        audio: {
          output: { voice: REALTIME_VOICE },
        },
      };
    }

    // Legacy schema: session.voice
    return {
      ...baseSession,
      voice: REALTIME_VOICE,
    };
  }

  function sendSessionUpdate(ws) {
    // schema selection:
    // - forced by env REALTIME_SESSION_SCHEMA=new|legacy
    // - else auto: try new first, fallback legacy on error
    let schemaToUse = "new";
    if (sessionSchema === "legacy") schemaToUse = "legacy";
    if (sessionSchema === "new") schemaToUse = "new";

    if (sessionSchema === "auto") {
      if (schemaChosen) schemaToUse = schemaChosen;
      else if (!schemaTriedNew) schemaToUse = "new";
      else schemaToUse = "legacy";
    }

    if (schemaToUse === "new") schemaTriedNew = true;
    if (schemaToUse === "legacy") schemaTriedLegacy = true;

    const payload = buildSessionUpdatePayload(schemaToUse);

    const ok = wsSend(ws, {
      type: "session.update",
      session: payload,
    });

    if (ok) {
      schemaChosen = schemaChosen || schemaToUse;
    }

    return { ok, schemaToUse };
  }

  function forceSchemaFallback(ws) {
    // If new failed, try legacy (once). If legacy failed, try new (once).
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;

    if (schemaChosen === "new" && !schemaTriedLegacy) {
      console.log("[openai] schema fallback -> legacy session.update");
      schemaChosen = "legacy";
      return sendSessionUpdate(ws).ok;
    }

    if (schemaChosen === "legacy" && !schemaTriedNew) {
      console.log("[openai] schema fallback -> new session.update");
      schemaChosen = "new";
      return sendSessionUpdate(ws).ok;
    }

    // auto mode and we haven't chosen yet
    if (!schemaChosen) {
      if (schemaTriedNew && !schemaTriedLegacy) {
        console.log("[openai] schema fallback -> legacy session.update");
        schemaChosen = "legacy";
        return sendSessionUpdate(ws).ok;
      }
      if (schemaTriedLegacy && !schemaTriedNew) {
        console.log("[openai] schema fallback -> new session.update");
        schemaChosen = "new";
        return sendSessionUpdate(ws).ok;
      }
    }

    return false;
  }

  function attachOpenAiHandlers(ws) {
    ws.on("open", () => {
      diag.counters.openaiConnections += 1;
      openaiConnecting = false;
      openaiReady = false;
      diag.lastOpenAiOpenAt = nowIso();

      console.log("[openai] ws open -> session.update", {
        model: REALTIME_MODEL,
        voice: REALTIME_VOICE,
        schema: sessionSchema,
      });

      // Try sending session update immediately
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
        diag.lastOpenAiErrorAt = nowIso();
        diag.lastOpenAiError = msg;

        const code = msg?.error?.code || msg?.error?.type || "";
        if (code === "conversation_already_has_active_response") {
          diag.counters.openaiActiveResponseErrors += 1;
          responseInFlight = true;
        }

        // If session.update schema was rejected, try fallback once
        const message = String(msg?.error?.message || "");
        const looksLikeSchemaIssue =
          message.includes("voice") ||
          message.includes("audio") ||
          message.includes("session") ||
          message.includes("unknown") ||
          message.includes("invalid");

        console.error("[openai] error:", JSON.stringify(msg, null, 2));

        if (!openaiReady && looksLikeSchemaIssue) {
          const did = forceSchemaFallback(ws);
          if (did) return;
        }

        return;
      }

      if (msg.type === "session.updated") {
        openaiReady = true;
        diag.lastOpenAiSessionUpdatedAt = nowIso();
        console.log("[openai] session.updated -> ready", { schemaChosen: schemaChosen || "unknown" });
        tryGreet();
        return;
      }

      // Audio from OpenAI -> Twilio
      const audioDelta = extractAudioDelta(msg);
      if (audioDelta && streamSid) {
        respOutboundAudioFrames += 1;
        outboundAudioFramesTotal += 1;
        diag.counters.openaiAudioDeltas += 1;

        if (outboundAudioFramesTotal === 1) {
          diag.lastOutboundAudioAt = nowIso();
          console.log("[audio] first outbound audio delta -> Twilio", { at: diag.lastOutboundAudioAt });
        }

        wsSend(twilioWs, { event: "media", streamSid, media: { payload: audioDelta } });
        return;
      }

      // Text deltas
      const textDelta = extractTextDelta(msg);
      if (textDelta) {
        respOutboundTextPieces += 1;
        diag.counters.openaiTextDeltas += 1;
        diag.lastOutboundTextAt = nowIso();
        diag.lastOutboundTextSample = String(textDelta).slice(0, 180);
        if (DEBUG_OPENAI_TEXT) console.log("[text] delta:", String(textDelta).slice(0, 200));
      }

      // Response lifecycle
      if (msg.type === "response.created" || msg.type === "response.started") {
        responseInFlight = true;
        return;
      }

      if (
        msg.type === "response.done" ||
        msg.type === "response.completed" ||
        msg.type === "response.stopped"
      ) {
        markResponseDone(msg);

        if (respOutboundAudioFrames === 0 && respOutboundTextPieces === 0) {
          console.log("[openai] response.done with NO output -> gated forceSpeak");
          safeForceSpeak("response_done_no_output");
        }

        mediaFramesSinceLastResponse = 0;
        pendingResponseTimer = clearTimer(pendingResponseTimer);
        return;
      }

      // Barge-in
      if (msg.type === "input_audio_buffer.speech_started") {
        if (responseInFlight) maybeCancelForBargeIn();
        return;
      }

      // Speech stopped -> respond (debounced)
      if (msg.type === "input_audio_buffer.speech_stopped") {
        if (responseInFlight) return;
        if (mediaFramesSinceLastResponse < MIN_MEDIA_FRAMES) return;

        pendingResponseTimer = clearTimer(pendingResponseTimer);
        pendingResponseTimer = setTimeout(() => {
          if (closed) return;
          if (!openaiReady) return;
          if (responseInFlight) return;
          if (mediaFramesSinceLastResponse < MIN_MEDIA_FRAMES) return;

          wsSend(openaiWs, { type: "input_audio_buffer.commit" });

          const ok = createResponse(
            "Reply briefly and warmly in ENGLISH (1–2 sentences). Ask ONE question if needed."
          );
          if (ok) armAudioWatchdog("post_speech");
        }, SPEECH_STOP_DEBOUNCE_MS);

        return;
      }

      // Tool calling: delta args
      if (msg.type === "response.function_call_arguments.delta") {
        const call_id = msg.call_id || msg.callId || msg.id;
        const delta = msg.delta || "";
        if (!call_id) return;
        const prev = toolArgBuffers.get(call_id) || "";
        toolArgBuffers.set(call_id, prev + delta);
        return;
      }

      // Tool calling: done
      if (msg.type === "response.function_call_arguments.done") {
        const call_id = msg.call_id || msg.callId || msg.id;
        const name = msg.name || msg.tool_name || msg.function?.name;
        if (!call_id || !name) return;

        const buf = toolArgBuffers.get(call_id) || "";
        toolArgBuffers.delete(call_id);

        let args = {};
        try {
          args = buf ? JSON.parse(buf) : {};
        } catch {
          args = {};
        }

        console.log("[tool] received", { name, callId: call_id, args, at: nowIso() });

        const result = await runToolCall(name, args);
        sendToolResultToOpenAI(call_id, result);
        return;
      }

      // Alternate tool shape
      if (msg.type === "response.output_item.added" && msg.item?.type === "function_call") {
        const call_id = msg.item.call_id || msg.item.id;
        const name = msg.item.name;
        const argsRaw = msg.item.arguments || "{}";

        let args = {};
        try {
          args = JSON.parse(argsRaw);
        } catch {
          args = {};
        }

        console.log("[tool] received", { name, callId: call_id, args, at: nowIso() });

        const result = await runToolCall(name, args);
        sendToolResultToOpenAI(call_id, result);
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
      diag.lastOpenAiErrorAt = nowIso();
      diag.lastOpenAiError = String(e?.message || e);
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

  // Start OpenAI
  connectOpenAi();

  // Twilio inbound
  twilioWs.on("message", (data) => {
    const msg = safeJsonParse(data.toString());
    if (!msg) return;

    if (DEBUG_TWILIO_EVENTS) console.log("[twilio:event]", msg.event);

    if (msg.event === "start") {
      streamSid = msg.start?.streamSid || null;

      const cp = msg.start?.customParameters || {};
      custom = {
        base: String(cp.base || cp.BASE || "").trim(),
        roomId: String(cp.roomId || cp.roomid || "").trim(),
        callSid: String(cp.callSid || cp.callsid || "").trim(),
        from: String(cp.from || cp.FROM || "").trim(),
        source: String(cp.source || "").trim(),
      };

      diag.lastTwilioStartAt = nowIso();

      console.log("[twilio] start", {
        streamSid,
        callSid: custom.callSid || null,
        roomId: custom.roomId || null,
        from: custom.from || null,
      });

      tryGreet();
      return;
    }

    if (msg.event === "media") {
      const payload = msg.media?.payload;
      if (!payload) return;

      inboundMediaFrames += 1;
      diag.counters.twilioMediaFrames += 1;
      diag.lastTwilioMediaAt = nowIso();

      if (inboundMediaFrames === 1) {
        diag.lastInboundAudioAt = nowIso();
        console.log("[audio] first inbound Twilio media frame", { at: diag.lastInboundAudioAt });
      }

      if (!openaiReady) return;

      mediaFramesSinceLastResponse += 1;
      wsSend(openaiWs, { type: "input_audio_buffer.append", audio: payload });
      return;
    }

    if (msg.event === "stop") {
      console.log("[twilio] stop");
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
