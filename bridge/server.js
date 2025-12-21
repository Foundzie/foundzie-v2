import http from "http";
import { WebSocketServer, WebSocket } from "ws";

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
  if (!ws) return;
  if (ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(obj));
  } catch {}
}

/**
 * Tuning knobs to reduce “cutting you off”
 * - MIN_MEDIA_FRAMES: require at least N Twilio media packets before responding
 *   (Twilio media packets are typically ~20ms each)
 * - SPEECH_STOP_DEBOUNCE_MS: wait a bit after speech_stopped before responding
 * - VAD_SILENCE_MS: tell OpenAI to wait longer silence before declaring “stopped”
 */
const MIN_MEDIA_FRAMES = Number(process.env.MIN_MEDIA_FRAMES || 10); // ~200ms
const SPEECH_STOP_DEBOUNCE_MS = Number(process.env.SPEECH_STOP_DEBOUNCE_MS || 450);
const VAD_SILENCE_MS = Number(process.env.VAD_SILENCE_MS || 700);

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
  let openaiReady = false;

  // Prevent duplicate responses / overlapping responses
  let responseInProgress = false;

  // Track if we actually received enough audio before responding
  let mediaFramesSinceLastResponse = 0;

  // Greeting protection
  let greeted = false;

  // Debounce timer so speech_stopped doesn’t instantly trigger response
  let pendingResponseTimer = null;

  let closed = false;

  const openaiWs = new WebSocket(OPENAI_REALTIME_URL, {
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "OpenAI-Beta": "realtime=v1",
    },
  });

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

    console.log("[bridge] shutdown:", reason || "unknown");

    try {
      if (openaiWs.readyState === WebSocket.OPEN) openaiWs.close();
    } catch {}
    try {
      if (twilioWs.readyState === WebSocket.OPEN) twilioWs.close();
    } catch {}
  }

  function tryGreet() {
    if (greeted) return;
    if (!openaiReady) return;
    if (!streamSid) return;

    greeted = true;
    responseInProgress = true;

    wsSend(openaiWs, {
      type: "response.create",
      response: {
        // HARDWIRE ENGLISH
        instructions:
          "You are Foundzie on a real phone call. Speak ONLY ENGLISH. " +
          "Greet the caller warmly in ONE short sentence, then ask ONE short question: “How can I help?”",
      },
    });

    console.log("[bridge] greeting triggered");
  }

  // Keepalive ping
  const pingInterval = setInterval(() => {
    try {
      if (twilioWs.readyState === WebSocket.OPEN) twilioWs.ping();
    } catch {}
    try {
      if (openaiWs.readyState === WebSocket.OPEN) openaiWs.ping();
    } catch {}
  }, 15000);

  openaiWs.on("open", () => {
    wsSend(openaiWs, {
      type: "session.update",
      session: {
        modalities: ["audio", "text"],
        voice: REALTIME_VOICE,
        input_audio_format: "g711_ulaw",
        output_audio_format: "g711_ulaw",

        // Wait longer before deciding you stopped speaking
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
          "Do not mention being an AI unless asked.",
      },
    });

    openaiReady = true;
    console.log("[openai] ws open; session.update sent");

    tryGreet();
  });

  openaiWs.on("message", (data) => {
    const msg = safeJsonParse(data.toString());
    if (!msg) return;

    // Audio from OpenAI -> Twilio
    if (msg.type === "response.audio.delta" && msg.delta && streamSid) {
      wsSend(twilioWs, {
        event: "media",
        streamSid,
        media: { payload: msg.delta },
      });
      return;
    }

    // Response lifecycle (different models may emit different “done” events)
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

    // Some implementations emit response.created/started
    if (msg.type === "response.created" || msg.type === "response.started") {
      responseInProgress = true;
      return;
    }

    // VAD says user stopped speaking → create response (guarded + debounced)
    if (msg.type === "input_audio_buffer.speech_stopped") {
      // If assistant is already talking, ignore
      if (responseInProgress) return;

      // If we barely received audio, ignore (prevents commit_empty behavior)
      if (mediaFramesSinceLastResponse < MIN_MEDIA_FRAMES) return;

      // Debounce so short pauses don't trigger instantly
      clearPendingTimer();
      pendingResponseTimer = setTimeout(() => {
        if (closed) return;
        if (responseInProgress) return;
        if (mediaFramesSinceLastResponse < MIN_MEDIA_FRAMES) return;

        responseInProgress = true;

        wsSend(openaiWs, { type: "response.create" });
      }, SPEECH_STOP_DEBOUNCE_MS);

      return;
    }

    // Log errors (and prevent spam loops)
    if (msg.type === "error") {
      const code = msg?.error?.code || msg?.code;

      // If we tried to create while already active, just mark in progress and move on
      if (code === "conversation_already_has_active_response") {
        responseInProgress = true;
        return;
      }

      console.error("[openai] error:", msg);
      return;
    }

    // If session changes, try greet again (safe)
    if (msg.type === "session.created" || msg.type === "session.updated") {
      tryGreet();
      return;
    }
  });

  openaiWs.on("close", () => {
    console.log("[openai] closed");
    shutdown("openai_closed");
  });

  openaiWs.on("error", (e) => {
    console.error("[openai] ws error:", e);
    shutdown("openai_error");
  });

  twilioWs.on("message", (data) => {
    const msg = safeJsonParse(data.toString());
    if (!msg) return;

    if (msg.event === "start") {
      streamSid = msg.start?.streamSid || null;
      console.log("[twilio] start streamSid=", streamSid);
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
