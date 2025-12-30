import http from "http";
import { WebSocketServer, WebSocket } from "ws";

/**
 * Foundzie Twilio <Connect><Stream> bridge (Fly.io)
 * - Receives Twilio Media Streams (g711_ulaw)
 * - Sends audio to OpenAI Realtime
 * - Sends audio back to Twilio
 * - Enables tool calling by POSTing:
 *     POST {BASE}/api/tools/call_third_party
 */

const PORT = process.env.PORT || 8080;

const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || "").trim();
if (!OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY");
  process.exit(1);
}

const REALTIME_MODEL = (process.env.REALTIME_MODEL || "gpt-4o-realtime-preview").trim();
const REALTIME_VOICE = (process.env.REALTIME_VOICE || "alloy").trim();

const OPENAI_REALTIME_URL = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(
  REALTIME_MODEL
)}`;

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

function nowIso() {
  return new Date().toISOString();
}

/**
 * Tunables
 */
const MIN_MEDIA_FRAMES = Number(process.env.MIN_MEDIA_FRAMES || 10);
const SPEECH_STOP_DEBOUNCE_MS = Number(process.env.SPEECH_STOP_DEBOUNCE_MS || 450);
const VAD_SILENCE_MS = Number(process.env.VAD_SILENCE_MS || 700);

// Reconnect tuning
const OPENAI_RECONNECT_MAX = Number(process.env.OPENAI_RECONNECT_MAX || 3);
const OPENAI_RECONNECT_DELAY_MS = Number(process.env.OPENAI_RECONNECT_DELAY_MS || 600);

// Tool calling tuning
const TOOL_CALL_COOLDOWN_MS = Number(process.env.TOOL_CALL_COOLDOWN_MS || 2500);

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
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

wss.on("connection", (twilioWs) => {
  console.log("[twilio] ws connected");

  let streamSid = null;

  // From Twilio start.customParameters
  let custom = {
    base: "",
    roomId: "",
    callSid: "",
    from: "",
    source: "",
  };

  // OpenAI socket + state
  let openaiWs = null;
  let openaiReady = false;
  let openaiConnecting = false;
  let openaiReconnects = 0;

  let responseInProgress = false;
  let mediaFramesSinceLastResponse = 0;

  let greeted = false;
  let pendingResponseTimer = null;

  // Tool buffers
  const toolArgBuffers = new Map(); // call_id -> string
  const toolCooldownMap = new Map(); // fp -> lastTimeMs
  const seenToolKeys = new Set(); // exact args, short TTL

  // Audio diagnostics
  let outboundAudioFrames = 0;
  let greetingRetryTimer = null;

  let closed = false;

  function clearPendingTimer() {
    if (pendingResponseTimer) {
      clearTimeout(pendingResponseTimer);
      pendingResponseTimer = null;
    }
  }

  function clearGreetingRetry() {
    if (greetingRetryTimer) {
      clearTimeout(greetingRetryTimer);
      greetingRetryTimer = null;
    }
  }

  function shutdown(reason) {
    if (closed) return;
    closed = true;

    clearPendingTimer();
    clearGreetingRetry();
    clearInterval(pingInterval);

    console.log("[bridge] shutdown:", reason || "unknown");

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

  /**
   * ✅ IMPORTANT FIX:
   * OpenAI Realtime rejects modalities ["audio"].
   * Supported combos include ["audio","text"].
   */
  function createAudioResponse(instructions) {
    wsSend(openaiWs, {
      type: "response.create",
      response: {
        modalities: ["audio", "text"],
        instructions,
      },
    });
  }

  function tryGreet() {
    if (greeted) return;
    if (!openaiReady) return;
    if (!streamSid) return;

    greeted = true;
    responseInProgress = true;
    outboundAudioFrames = 0;

    createAudioResponse(
      "You are Foundzie on a REAL phone call. Speak ONLY ENGLISH. " +
        "Greet the caller warmly in ONE short sentence, then ask ONE short question: “How can I help?”"
    );

    console.log("[bridge] greeting triggered");

    // If no audio deltas appear quickly, retry once
    clearGreetingRetry();
    greetingRetryTimer = setTimeout(() => {
      if (closed) return;
      if (!openaiReady) return;
      if (outboundAudioFrames > 0) return;

      console.log("[bridge] greeting retry: no outbound audio deltas observed");
      responseInProgress = true;
      createAudioResponse(
        "Speak now. Greet the caller warmly and ask: “How can I help?” Keep it short."
      );
    }, 1800);
  }

  // Keepalive ping (Twilio only)
  const pingInterval = setInterval(() => {
    try {
      if (twilioWs.readyState === WebSocket.OPEN) twilioWs.ping();
    } catch {}
  }, 15000);

  async function runToolCall(name, args, call_id) {
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

    if (name !== "call_third_party") {
      return { ok: false, message: `Unknown tool: ${name}` };
    }

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
      item: {
        type: "function_call_output",
        call_id,
        output: JSON.stringify(resultObj || {}),
      },
    });

    createAudioResponse(
      "Continue the phone call naturally in ENGLISH. " +
        "If the tool succeeded, confirm briefly in one sentence. " +
        "If it failed, apologize briefly and ask ONE short question."
    );
  }

  /**
   * ✅ IMPORTANT FIX:
   * OpenAI Realtime rejects response.cancel with {reason:...}.
   */
  function cancelOpenAIResponse() {
    if (!openaiWs) return;
    wsSend(openaiWs, { type: "response.cancel" });
    responseInProgress = false;
    clearPendingTimer();
  }

  function attachOpenAiHandlers(ws) {
    ws.on("open", () => {
      openaiReady = true;
      openaiConnecting = false;

      wsSend(ws, {
        type: "session.update",
        session: {
          modalities: ["audio", "text"],
          voice: REALTIME_VOICE,
          input_audio_format: "g711_ulaw",
          output_audio_format: "g711_ulaw",
          turn_detection: {
            type: "server_vad",
            silence_duration_ms: VAD_SILENCE_MS,
          },
          instructions:
            "You are Foundzie, a lightning-fast personal concierge on a REAL phone call. " +
            "ALWAYS speak ENGLISH unless the caller explicitly asks for another language. " +
            "Sound natural, warm, confident, like a human. " +
            "Keep replies short (1–2 sentences). " +
            "Ask only ONE follow-up question when needed. " +
            "If the caller starts speaking while you are speaking, STOP and listen. " +
            "Do not mention being an AI unless asked.",
          tools: [
            {
              type: "function",
              name: "call_third_party",
              description:
                "Call a third-party phone number and deliver a short spoken message, and bridge into the current call if callSid/roomId are provided.",
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
        },
      });

      console.log("[openai] ws open; session.update sent");
      tryGreet();
    });

    ws.on("message", async (data) => {
      const msg = safeJsonParse(data.toString());
      if (!msg) return;

      // Audio from OpenAI -> Twilio
      if (msg.type === "response.audio.delta" && msg.delta && streamSid) {
        outboundAudioFrames += 1;
        if (outboundAudioFrames === 1) {
          console.log("[audio] first outbound audio delta -> Twilio", { at: nowIso() });
        }

        wsSend(twilioWs, {
          event: "media",
          streamSid,
          media: { payload: msg.delta },
        });
        return;
      }

      // Response lifecycle
      if (
        msg.type === "response.done" ||
        msg.type === "response.completed" ||
        msg.type === "response.stopped"
      ) {
        responseInProgress = false;
        mediaFramesSinceLastResponse = 0;
        clearPendingTimer();
        return;
      }

      if (msg.type === "response.created" || msg.type === "response.started") {
        responseInProgress = true;
        return;
      }

      // Barge-in
      if (msg.type === "input_audio_buffer.speech_started") {
        if (responseInProgress) {
          console.log("[vad] speech_started while responding -> cancel");
          cancelOpenAIResponse();
        }
        return;
      }

      // Speech stopped -> respond (debounced)
      if (msg.type === "input_audio_buffer.speech_stopped") {
        if (responseInProgress) return;
        if (mediaFramesSinceLastResponse < MIN_MEDIA_FRAMES) return;

        clearPendingTimer();
        pendingResponseTimer = setTimeout(() => {
          if (closed) return;
          if (!openaiReady) return;
          if (responseInProgress) return;
          if (mediaFramesSinceLastResponse < MIN_MEDIA_FRAMES) return;

          responseInProgress = true;

          wsSend(openaiWs, { type: "input_audio_buffer.commit" });
          createAudioResponse(
            "Respond briefly in ENGLISH (1–2 sentences). Ask ONE short follow-up question if needed."
          );
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

        const result = await runToolCall(name, args, call_id);
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

        const result = await runToolCall(name, args, call_id);
        sendToolResultToOpenAI(call_id, result);
        return;
      }

      // Errors
      if (msg.type === "error") {
        const code = msg?.error?.code || msg?.code;

        if (code === "conversation_already_has_active_response") {
          responseInProgress = true;
          return;
        }

        console.error("[openai] error:", msg);
        return;
      }

      if (msg.type === "session.created" || msg.type === "session.updated") {
        tryGreet();
        return;
      }
    });

    ws.on("close", () => {
      console.log("[openai] closed");

      openaiReady = false;
      openaiConnecting = false;

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

    try {
      openaiWs = new WebSocket(OPENAI_REALTIME_URL, {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "OpenAI-Beta": "realtime=v1",
        },
      });

      attachOpenAiHandlers(openaiWs);
    } catch (e) {
      openaiConnecting = false;
      console.error("[openai] connect error:", e);
    }
  }

  // Start OpenAI
  connectOpenAi();

  // Twilio inbound
  twilioWs.on("message", (data) => {
    const msg = safeJsonParse(data.toString());
    if (!msg) return;

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

      console.log(
        "[twilio] start streamSid=",
        streamSid,
        "callSid=",
        custom.callSid || "(none)",
        "roomId=",
        custom.roomId || "(none)"
      );

      tryGreet();
      return;
    }

    if (msg.event === "media") {
      const payload = msg.media?.payload;
      if (!payload) return;
      if (!openaiReady) return;

      mediaFramesSinceLastResponse += 1;

      wsSend(openaiWs, {
        type: "input_audio_buffer.append",
        audio: payload,
      });
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

server.listen(PORT, () => {
  console.log(`Bridge listening on :${PORT}`);
});
