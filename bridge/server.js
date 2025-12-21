import http from "http";
import { WebSocketServer, WebSocket } from "ws";

const PORT = process.env.PORT || 8080;

const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || "").trim();
if (!OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY");
  process.exit(1);
}

const REALTIME_MODEL = (process.env.REALTIME_MODEL || "gpt-4o-realtime-preview").trim();

// IMPORTANT: Voice here is OpenAI realtime voice (NOT Twilio TTS).
// Try: alloy / shimmer / verse (depends on model availability in your account)
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
  let greeted = false;
  let closed = false;

  const openaiWs = new WebSocket(OPENAI_REALTIME_URL, {
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "OpenAI-Beta": "realtime=v1",
    },
  });

  function tryGreet() {
    if (greeted) return;
    if (!openaiReady) return;
    if (!streamSid) return;

    greeted = true;

    // Ask OpenAI to speak immediately
    wsSend(openaiWs, {
      type: "response.create",
      response: {
        instructions:
          "Greet the caller warmly in one short sentence, then ask how you can help.",
      },
    });

    console.log("[bridge] greeting triggered");
  }

  // Keepalive ping (helps prevent silent disconnects)
  const pingInterval = setInterval(() => {
    try {
      if (twilioWs.readyState === WebSocket.OPEN) twilioWs.ping();
    } catch {}
    try {
      if (openaiWs.readyState === WebSocket.OPEN) openaiWs.ping();
    } catch {}
  }, 15000);

  function shutdown(reason) {
    if (closed) return;
    closed = true;
    clearInterval(pingInterval);

    console.log("[bridge] shutdown:", reason || "unknown");

    try {
      if (openaiWs.readyState === WebSocket.OPEN) openaiWs.close();
    } catch {}
    try {
      if (twilioWs.readyState === WebSocket.OPEN) twilioWs.close();
    } catch {}
  }

  openaiWs.on("open", () => {
    // Create/update the realtime session
    wsSend(openaiWs, {
      type: "session.update",
      session: {
        modalities: ["audio", "text"],
        voice: REALTIME_VOICE,
        input_audio_format: "g711_ulaw",
        output_audio_format: "g711_ulaw",
        turn_detection: { type: "server_vad" },
        instructions:
          "You are Foundzie, a lightning-fast personal concierge on a REAL phone call. " +
          "Sound natural, warm, confident, like a human. " +
          "Keep replies short (1–2 sentences). " +
          "Ask only ONE follow-up question when needed. " +
          "Do not mention being an AI unless asked.",
      },
    });

    openaiReady = true;
    console.log("[openai] ws open; session.update sent");

    // If Twilio already started, greet now
    tryGreet();
  });

  openaiWs.on("message", (data) => {
    const msg = safeJsonParse(data.toString());
    if (!msg) return;

    // Useful debug if needed:
    // console.log("[openai] msg", msg.type);

    // Audio from OpenAI -> Twilio
    if (msg.type === "response.audio.delta" && msg.delta && streamSid) {
      wsSend(twilioWs, {
        event: "media",
        streamSid,
        media: { payload: msg.delta },
      });
      return;
    }

    // When OpenAI thinks user stopped talking -> ask it to respond
    if (msg.type === "input_audio_buffer.speech_stopped") {
      // Commit buffer then create a response (more reliable)
      wsSend(openaiWs, { type: "input_audio_buffer.commit" });
      wsSend(openaiWs, { type: "response.create" });
      // Optional cleanup
      wsSend(openaiWs, { type: "input_audio_buffer.clear" });
      return;
    }

    // If OpenAI tells us about errors, log them
    if (msg.type === "error") {
      console.error("[openai] error:", msg);
      return;
    }

    // If a session event comes, we can attempt greeting again
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

      // If OpenAI is ready, greet immediately
      tryGreet();
      return;
    }

    if (msg.event === "media") {
      const payload = msg.media?.payload;
      if (!payload) return;
      if (!openaiReady) return;

      // Feed audio to OpenAI
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
