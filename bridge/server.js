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
 * Tunables
 */
const MIN_MEDIA_FRAMES = Number(process.env.MIN_MEDIA_FRAMES || 10); // ~200ms
const SPEECH_STOP_DEBOUNCE_MS = Number(process.env.SPEECH_STOP_DEBOUNCE_MS || 450);
const VAD_SILENCE_MS = Number(process.env.VAD_SILENCE_MS || 700);

// Reconnect tuning
const OPENAI_RECONNECT_MAX = Number(process.env.OPENAI_RECONNECT_MAX || 3);
const OPENAI_RECONNECT_DELAY_MS = Number(process.env.OPENAI_RECONNECT_DELAY_MS || 600);

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

  // OpenAI socket + state
  let openaiWs = null;
  let openaiReady = false;
  let openaiConnecting = false;
  let openaiReconnects = 0;

  // Prevent duplicate responses / overlapping responses
  let responseInProgress = false;

  // Track if we actually received enough audio before responding
  let mediaFramesSinceLastResponse = 0;

  // Greeting protection
  let greeted = false;

  // Debounce timer so speech_stopped doesn’t instantly trigger response
  let pendingResponseTimer = null;

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

    console.log("[bridge] shutdown:", reason || "unknown");

    try {
      if (openaiWs && openaiWs.readyState === WebSocket.OPEN) openaiWs.close();
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
        instructions:
          "You are Foundzie on a real phone call. Speak ONLY ENGLISH. " +
          "Greet the caller warmly in ONE short sentence, then ask ONE short question: “How can I help?”",
      },
    });

    console.log("[bridge] greeting triggered");
  }

  // Keepalive ping (Twilio only)
  const pingInterval = setInterval(() => {
    try {
      if (twilioWs.readyState === WebSocket.OPEN) twilioWs.ping();
    } catch {}
  }, 15000);

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
            "Do not mention being an AI unless asked.",
        },
      });

      console.log("[openai] ws open; session.update sent");
      tryGreet();
    });

    ws.on("message", (data) => {
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

      // VAD says user stopped speaking → create response (guarded + debounced)
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

          // Commit audio, then respond
          wsSend(openaiWs, { type: "input_audio_buffer.commit" });
          wsSend(openaiWs, { type: "response.create" });
        }, SPEECH_STOP_DEBOUNCE_MS);

        return;
      }

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

      // CRITICAL FIX:
      // Do NOT shutdown the Twilio call when OpenAI closes.
      // Attempt reconnect while keeping Twilio stream alive.
      openaiReady = false;
      openaiConnecting = false;

      if (closed) return;
      if (twilioWs.readyState !== WebSocket.OPEN) return;

      if (openaiReconnects >= OPENAI_RECONNECT_MAX) {
        console.error("[openai] reconnect limit reached; keeping Twilio alive but no AI");
        // We keep Twilio alive; user will hear silence until AI returns.
        // (Optional: you can add a Twilio-side fallback Gather in your TwiML.)
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
      // same behavior as close: do NOT kill Twilio; let close handler reconnect
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
      console.log("[twilio] start streamSid=", streamSid);
      tryGreet();
      return;
    }

    if (msg.event === "media") {
      const payload = msg.media?.payload;
      if (!payload) return;

      // Still allow Twilio audio to keep flowing even while OpenAI reconnects
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
