import http from "http";
import { WebSocketServer, WebSocket } from "ws";

const PORT = process.env.PORT || 8080;

const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || "").trim();
if (!OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY");
  process.exit(1);
}

const REALTIME_MODEL = (process.env.REALTIME_MODEL || "gpt-4o-realtime-preview").trim();
const REALTIME_VOICE = (process.env.REALTIME_VOICE || "shimmer").trim();

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

  const openaiWs = new WebSocket(OPENAI_REALTIME_URL, {
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "OpenAI-Beta": "realtime=v1",
    },
  });

  openaiWs.on("open", () => {
    openaiWs.send(
      JSON.stringify({
        type: "session.update",
        session: {
          modalities: ["audio", "text"],
          voice: REALTIME_VOICE,
          input_audio_format: "g711_ulaw",
          output_audio_format: "g711_ulaw",

          // Let OpenAI detect turn boundaries (when user stops speaking)
          turn_detection: { type: "server_vad" },

          instructions:
            "You are Foundzie, a lightning-fast personal concierge on a REAL phone call. " +
            "Sound natural, warm, confident. Keep replies short (1–2 sentences). " +
            "Ask only ONE follow-up question when needed. " +
            "Do not mention being an AI unless asked.",
        },
      })
    );

    openaiReady = true;
    console.log("[openai] session ready");
  });

  openaiWs.on("message", (data) => {
    const msg = safeJsonParse(data.toString());
    if (!msg) return;

    // After OpenAI is ready and Twilio has streamSid, greet once
    if (!greeted && openaiReady && streamSid) {
      greeted = true;
      openaiWs.send(
        JSON.stringify({
          type: "response.create",
          response: { instructions: "Greet the caller briefly and ask how you can help." },
        })
      );
    }

    // Send audio back to Twilio
    if (msg.type === "response.audio.delta" && msg.delta && streamSid) {
      twilioWs.send(
        JSON.stringify({
          event: "media",
          streamSid,
          media: { payload: msg.delta },
        })
      );
      return;
    }

    // When VAD detects user finished speaking, ask OpenAI to respond
    if (msg.type === "input_audio_buffer.speech_stopped") {
      openaiWs.send(JSON.stringify({ type: "response.create" }));
      return;
    }
  });

  openaiWs.on("close", () => {
    console.log("[openai] closed");
    try { twilioWs.close(); } catch {}
  });

  openaiWs.on("error", (e) => {
    console.error("[openai] ws error:", e);
    try { twilioWs.close(); } catch {}
  });

  twilioWs.on("message", (data) => {
    const msg = safeJsonParse(data.toString());
    if (!msg) return;

    if (msg.event === "start") {
      streamSid = msg.start?.streamSid || null;
      console.log("[twilio] start streamSid=", streamSid);

      // greeting will happen via openaiWs message handler once both ready
      return;
    }

    if (msg.event === "media") {
      const payload = msg.media?.payload;
      if (!payload || !openaiReady) return;

      // Just append continuously; server_vad will decide when user stops talking
      openaiWs.send(JSON.stringify({ type: "input_audio_buffer.append", audio: payload }));
      return;
    }

    if (msg.event === "stop") {
      console.log("[twilio] stop");
      try { openaiWs.close(); } catch {}
      try { twilioWs.close(); } catch {}
    }
  });

  twilioWs.on("close", () => {
    console.log("[twilio] closed");
    try { openaiWs.close(); } catch {}
  });

  twilioWs.on("error", (e) => {
    console.error("[twilio] ws error:", e);
    try { openaiWs.close(); } catch {}
  });
});

server.listen(PORT, () => {
  console.log(`Bridge listening on :${PORT}`);
});
