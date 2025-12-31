import http from "http";
import { WebSocketServer, WebSocket } from "ws";

/**
 * Foundzie Twilio <Connect><Stream> bridge (Fly.io)
 * - Receives Twilio Media Streams (g711_ulaw base64)
 * - Sends audio to OpenAI Realtime
 * - Sends audio back to Twilio
 *
 * KEY FIX:
 * - Use the CURRENT Realtime session.update shape (audio:{input,output:{voice}})
 * - Log response.done to confirm whether OpenAI produced audio or only text
 */

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "0.0.0.0";

const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || "").trim();
if (!OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY");
  process.exit(1);
}

// Choose model explicitly via Fly secrets.
// Docs show gpt-realtime as the standard; preview models exist too.
const REALTIME_MODEL = (process.env.REALTIME_MODEL || "gpt-realtime").trim();
const REALTIME_VOICE = (process.env.REALTIME_VOICE || "alloy").trim();

// Debug flags
const DEBUG_OPENAI_EVENTS = (process.env.DEBUG_OPENAI_EVENTS || "").trim() === "1";
const DEBUG_OPENAI_DONE = (process.env.DEBUG_OPENAI_DONE || "").trim() === "1";

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

// Tunables
const MIN_MEDIA_FRAMES = Number(process.env.MIN_MEDIA_FRAMES || 10);
const SPEECH_STOP_DEBOUNCE_MS = Number(process.env.SPEECH_STOP_DEBOUNCE_MS || 450);
const VAD_SILENCE_MS = Number(process.env.VAD_SILENCE_MS || 700);

// Reconnect tuning
const OPENAI_RECONNECT_MAX = Number(process.env.OPENAI_RECONNECT_MAX || 3);
const OPENAI_RECONNECT_DELAY_MS = Number(process.env.OPENAI_RECONNECT_DELAY_MS || 600);

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, ts: nowIso(), model: REALTIME_MODEL }));
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

  // From Twilio <Stream><Parameter .../>
  let custom = { base: "", roomId: "", callSid: "", from: "", source: "" };

  // OpenAI
  let openaiWs = null;
  let openaiReady = false;
  let openaiConnecting = false;
  let openaiReconnects = 0;

  // State
  let responseInProgress = false;
  let mediaFramesSinceLastResponse = 0;
  let greeted = false;
  let pendingResponseTimer = null;

  // Diagnostics
  let inboundMediaFrames = 0;
  let outboundAudioFrames = 0;
  let closed = false;

  function clearPendingTimer() {
    if (pendingResponseTimer) {
      clearTimeout(pendingResponseTimer);
      pendingResponseTimer = null;
    }
  }

  function shutdown(reason) {
    if (closed) return;
    closed = true;

    clearPendingTimer();
    clearInterval(pingInterval);

    console.log("[bridge] shutdown:", reason || "unknown", {
      inboundMediaFrames,
      outboundAudioFrames,
      streamSid,
      callSid: custom.callSid || null,
      roomId: custom.roomId || null,
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

  // Keepalive ping (Twilio side)
  const pingInterval = setInterval(() => {
    try {
      if (twilioWs.readyState === WebSocket.OPEN) twilioWs.ping();
    } catch {}
  }, 15000);

  // IMPORTANT: Realtime wants modalities ["audio","text"] when we want speech + transcripts.
  function createAudioResponse(instructions) {
    return wsSend(openaiWs, {
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

    console.log("[bridge] greeting triggered");

    // This should generate outbound audio deltas if session audio output is configured correctly.
    createAudioResponse(
      "You are Foundzie on a REAL phone call. Speak warm and natural.\n" +
        "Greet in ONE short sentence, then ask: “How can I help?”\n" +
        "Do NOT explain capabilities or policies."
    );
  }

  function extractAudioDelta(msg) {
    if (!msg || typeof msg !== "object") return null;

    // Current common variants:
    if (msg.type === "response.output_audio.delta" && msg.delta) return msg.delta;
    if (msg.type === "response.audio.delta" && msg.delta) return msg.delta;

    // Alternate shapes some SDKs emit:
    if ((msg.type === "response.output_audio.delta" || msg.type === "response.audio.delta") && msg.audio?.delta)
      return msg.audio.delta;

    return null;
  }

  function logResponseDone(msg) {
    // Helps you see if OpenAI produced text-only output (no audio)
    try {
      const r = msg?.response || msg?.data?.response || null;
      if (!r) return;

      const outputs = Array.isArray(r.output) ? r.output : [];
      const summary = outputs.map((o) => {
        const type = o?.type || "unknown";
        const content = Array.isArray(o?.content) ? o.content : [];
        const contentTypes = content.map((c) => c?.type || "unknown");
        return { type, contentTypes };
      });

      console.log("[openai] response.done summary:", JSON.stringify(summary));
    } catch {}
  }

  function attachOpenAiHandlers(ws) {
    ws.on("open", () => {
      openaiReady = true;
      openaiConnecting = false;

      console.log("[openai] ws open -> session.update", {
        model: REALTIME_MODEL,
        voice: REALTIME_VOICE,
      });

      /**
       * ✅ KEY FIX:
       * Use the CURRENT session.update schema with audio input/output blocks.
       * (Older fields like input_audio_format/output_audio_format may lead to no audio deltas.)
       */
      wsSend(ws, {
        type: "session.update",
        session: {
          // Some accounts/models accept a "type" field; harmless if ignored.
          type: "realtime",
          model: REALTIME_MODEL,

          modalities: ["audio", "text"],

          audio: {
            input: { format: "g711_ulaw" },
            output: { format: "g711_ulaw", voice: REALTIME_VOICE },
          },

          turn_detection: {
            type: "server_vad",
            silence_duration_ms: VAD_SILENCE_MS,
          },

          instructions:
            "You are Foundzie, a lightning-fast personal concierge on a REAL phone call.\n" +
            "Reply in 1–2 short sentences.\n" +
            "Ask ONE short follow-up question when needed.\n" +
            "Do not explain capabilities/policies.\n" +
            "If caller speaks while you speak, stop and listen.",

          // You can add tools later; keep minimal while stabilizing audio.
          tool_choice: "auto",
        },
      });

      tryGreet();
    });

    ws.on("message", (data) => {
      const msg = safeJsonParse(data.toString());
      if (!msg) return;

      if (DEBUG_OPENAI_EVENTS) {
        const t = msg.type || "(no-type)";
        if (!String(t).includes("input_audio_buffer.append")) {
          console.log("[openai:event]", t);
        }
      }

      if (msg.type === "error") {
        console.error("[openai] error:", JSON.stringify(msg, null, 2));
        return;
      }

      // Forward outbound audio to Twilio
      const audioDelta = extractAudioDelta(msg);
      if (audioDelta && streamSid) {
        outboundAudioFrames += 1;
        if (outboundAudioFrames === 1) {
          console.log("[audio] first outbound audio delta -> Twilio", { at: nowIso() });
        }

        wsSend(twilioWs, {
          event: "media",
          streamSid,
          media: { payload: audioDelta },
        });
        return;
      }

      // Response lifecycle
      if (msg.type === "response.created" || msg.type === "response.started") {
        responseInProgress = true;
        return;
      }

      if (msg.type === "response.done" || msg.type === "response.completed" || msg.type === "response.stopped") {
        responseInProgress = false;
        mediaFramesSinceLastResponse = 0;
        clearPendingTimer();

        if (DEBUG_OPENAI_DONE) logResponseDone(msg);
        return;
      }

      // VAD events (from server_vad)
      if (msg.type === "input_audio_buffer.speech_started") {
        // If you later implement barge-in cancel, do it here.
        return;
      }

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

          // Commit buffered audio and ask for response
          wsSend(openaiWs, { type: "input_audio_buffer.commit" });
          createAudioResponse(
            "Respond naturally and briefly (1–2 sentences). Ask ONE short question if needed."
          );
        }, SPEECH_STOP_DEBOUNCE_MS);

        return;
      }

      // session events
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
        console.error("[openai] reconnect limit reached; Twilio stays up but no AI");
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
        // Safe to include; required for some preview behavior.
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
      if (!openaiReady) return;

      inboundMediaFrames += 1;
      if (inboundMediaFrames === 1) {
        console.log("[audio] first inbound Twilio media frame", { at: nowIso() });
      }

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
  });
});
