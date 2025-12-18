import http from "http";
import { WebSocketServer, WebSocket } from "ws";

const PORT = Number(process.env.PORT || 8080);

const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || "").trim();
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

function now() {
  return new Date().toISOString();
}

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.url === "/") {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end("Foundzie Bridge is running\n");
    return;
  }

  res.writeHead(404);
  res.end("not found");
});

const wss = new WebSocketServer({ server, path: "/twilio/stream" });

wss.on("connection", (twilioWs) => {
  console.log(`[${now()}] Twilio WS connected`);

  let streamSid = null;
  let openaiReady = false;
  let closed = false;

  // If key is missing, don’t crash the whole server process — just end this call cleanly.
  if (!OPENAI_API_KEY) {
    console.error(`[${now()}] Missing OPENAI_API_KEY (cannot start realtime).`);
    try { twilioWs.close(); } catch {}
    return;
  }

  const openaiWs = new WebSocket(OPENAI_REALTIME_URL, {
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "OpenAI-Beta": "realtime=v1",
    },
  });

  function cleanup() {
    if (closed) return;
    closed = true;
    try { openaiWs.close(); } catch {}
    try { twilioWs.close(); } catch {}
  }

  openaiWs.on("open", () => {
    console.log(`[${now()}] OpenAI WS connected`);
    openaiReady = true;

    // IMPORTANT: Let server-side VAD detect when user stops talking.
    openaiWs.send(
      JSON.stringify({
        type: "session.update",
        session: {
          modalities: ["audio", "text"],
          voice: REALTIME_VOICE,
          input_audio_format: "g711_ulaw",
          output_audio_format: "g711_ulaw",

          // Turn detection = natural conversation
          turn_detection: {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 700
          },

          instructions:
            "You are Foundzie, a lightning-fast personal concierge on a live phone call. " +
            "Speak naturally, short and friendly (1–2 sentences). " +
            "Ask at most one follow-up question at a time. " +
            "If the user is unclear, ask a clarifying question. " +
            "Do not mention that you are an AI model.",
        },
      })
    );

    // Initial greeting (one-time)
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

    // Stream audio from OpenAI → Twilio
    if (msg.type === "response.audio.delta" && msg.delta) {
      if (!streamSid) return;

      twilioWs.send(
        JSON.stringify({
          event: "media",
          streamSid,
          media: { payload: msg.delta },
        })
      );
      return;
    }

    // When OpenAI detects the user finished speaking, create ONE response.
    // Different builds may emit slightly different turn events; we handle common ones.
    if (
      msg.type === "input_audio_buffer.speech_stopped" ||
      msg.type === "input_audio_buffer.speech_end" ||
      msg.type === "turn.end"
    ) {
      if (!openaiReady) return;
      openaiWs.send(JSON.stringify({ type: "response.create" }));
      return;
    }

    // Helpful logging (optional)
    if (msg.type === "error") {
      console.error(`[${now()}] OpenAI error:`, msg);
    }
  });

  openaiWs.on("close", () => {
    console.log(`[${now()}] OpenAI WS closed`);
    cleanup();
  });

  openaiWs.on("error", (e) => {
    console.error(`[${now()}] OpenAI WS error:`, e);
    cleanup();
  });

  twilioWs.on("message", (data) => {
    const msg = safeJsonParse(data.toString());
    if (!msg) return;

    if (msg.event === "start") {
      streamSid = msg.start?.streamSid || null;
      console.log(`[${now()}] Twilio stream start sid=${streamSid}`);
      return;
    }

    // Twilio → OpenAI: just append audio continuously.
    if (msg.event === "media") {
      const payload = msg.media?.payload;
      if (!payload || !openaiReady) return;

      openaiWs.send(JSON.stringify({ type: "input_audio_buffer.append", audio: payload }));
      return;
    }

    if (msg.event === "stop") {
      console.log(`[${now()}] Twilio stream stop`);
      cleanup();
    }
  });

  twilioWs.on("close", () => {
    console.log(`[${now()}] Twilio WS closed`);
    cleanup();
  });

  twilioWs.on("error", (e) => {
    console.error(`[${now()}] Twilio WS error:`, e);
    cleanup();
  });
});

server.listen(PORT, () => {
  console.log(`Bridge listening on :${PORT}`);
});
