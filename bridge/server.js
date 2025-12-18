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
  res.writeHead(404);
  res.end("not found");
});

const wss = new WebSocketServer({ server, path: "/twilio/stream" });

wss.on("connection", (twilioWs) => {
  let streamSid = null;

  const openaiWs = new WebSocket(OPENAI_REALTIME_URL, {
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "OpenAI-Beta": "realtime=v1",
    },
  });

  let openaiReady = false;

  openaiWs.on("open", () => {
    openaiWs.send(
      JSON.stringify({
        type: "session.update",
        session: {
          modalities: ["audio", "text"],
          voice: REALTIME_VOICE,
          input_audio_format: "g711_ulaw",
          output_audio_format: "g711_ulaw",
          instructions:
            "You are Foundzie, a lightning-fast personal concierge. " +
            "You are on a real phone call. Keep replies short and natural (1–2 sentences). " +
            "Ask only one follow-up question when needed.",
        },
      })
    );

    openaiReady = true;

    openaiWs.send(
      JSON.stringify({
        type: "response.create",
        response: { instructions: "Greet the caller briefly and ask how you can help." },
      })
    );
  });

  openaiWs.on("message", (data) => {
    const msg = safeJsonParse(data.toString());
    if (!msg) return;

    if (msg.type === "response.audio.delta" && msg.delta) {
      if (!streamSid) return;

      twilioWs.send(
        JSON.stringify({
          event: "media",
          streamSid,
          media: { payload: msg.delta },
        })
      );
    }
  });

  openaiWs.on("close", () => {
    try { twilioWs.close(); } catch {}
  });

  openaiWs.on("error", (e) => {
    console.error("OpenAI WS error:", e);
    try { twilioWs.close(); } catch {}
  });

  twilioWs.on("message", (data) => {
    const msg = safeJsonParse(data.toString());
    if (!msg) return;

    if (msg.event === "start") {
      streamSid = msg.start?.streamSid || null;
      return;
    }

    if (msg.event === "media") {
      const payload = msg.media?.payload;
      if (!payload || !openaiReady) return;

      openaiWs.send(JSON.stringify({ type: "input_audio_buffer.append", audio: payload }));
      openaiWs.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
      openaiWs.send(JSON.stringify({ type: "response.create" }));
      return;
    }

    if (msg.event === "stop") {
      try { openaiWs.close(); } catch {}
      try { twilioWs.close(); } catch {}
    }
  });

  twilioWs.on("close", () => {
    try { openaiWs.close(); } catch {}
  });

  twilioWs.on("error", (e) => {
    console.error("Twilio WS error:", e);
    try { openaiWs.close(); } catch {}
  });
});

server.listen(PORT, () => {
  console.log(`Bridge listening on :${PORT}`);
});
