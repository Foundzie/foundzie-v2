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
  if (req.url === "/" || req.url === "/health") {
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

  // Tracks whether OpenAI is ready and whether caller is currently speaking
  let openaiReady = false;
  let callerSpeaking = false;

  const openaiWs = new WebSocket(OPENAI_REALTIME_URL, {
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "OpenAI-Beta": "realtime=v1",
    },
  });

  // Helper: tell Twilio to play an audio chunk
  function sendToTwilioAudio(base64Ulaw) {
    if (!streamSid) return;
    twilioWs.send(
      JSON.stringify({
        event: "media",
        streamSid,
        media: { payload: base64Ulaw },
      })
    );
  }

  openaiWs.on("open", () => {
    // IMPORTANT: Use server-side VAD so the model waits until the user finishes speaking.
    openaiWs.send(
      JSON.stringify({
        type: "session.update",
        session: {
          modalities: ["audio", "text"],
          voice: REALTIME_VOICE,
          input_audio_format: "g711_ulaw",
          output_audio_format: "g711_ulaw",

          // Key to naturalness:
          // - server_vad lets OpenAI decide when speech starts/stops
          // - creates responses only after speech stops (we do that below)
          turn_detection: {
            type: "server_vad",
            threshold: 0.6,
            prefix_padding_ms: 250,
            silence_duration_ms: 650,
          },

          // Make it sound human on phone
          instructions:
            "You are Foundzie, a friendly, human-sounding concierge on a phone call. " +
            "Speak naturally with short sentences, warm tone, and contractions (I'm, you're). " +
            "Never sound like a bot. No bullet points. " +
            "Ask at most one question at a time. " +
            "If the caller is silent, ask a gentle follow-up.",
        },
      })
    );

    openaiReady = true;

    // One-time greeting
    openaiWs.send(
      JSON.stringify({
        type: "response.create",
        response: {
          instructions:
            "Greet the caller naturally in one sentence, then ask what they need help with.",
        },
      })
    );
  });

  openaiWs.on("message", (data) => {
    const msg = safeJsonParse(data.toString());
    if (!msg) return;

    // OpenAI tells us when caller speech starts/stops (server VAD)
    if (msg.type === "input_audio_buffer.speech_started") {
      callerSpeaking = true;

      // If the user interrupts while the AI is talking, clear output so it doesn't talk over them
      openaiWs.send(JSON.stringify({ type: "output_audio_buffer.clear" }));
      return;
    }

    if (msg.type === "input_audio_buffer.speech_stopped") {
      callerSpeaking = false;

      // Caller finished a thought -> now ask the model to respond ONCE
      openaiWs.send(JSON.stringify({ type: "response.create" }));
      return;
    }

    // Stream AI audio back to Twilio
    if (msg.type === "response.audio.delta" && msg.delta) {
      sendToTwilioAudio(msg.delta);
      return;
    }

    // If you want to see text for debugging (optional):
    // if (msg.type === "response.text.delta" && msg.delta) console.log("AI:", msg.delta);
  });

  openaiWs.on("close", () => {
    try {
      twilioWs.close();
    } catch {}
  });

  openaiWs.on("error", (e) => {
    console.error("OpenAI WS error:", e);
    try {
      twilioWs.close();
    } catch {}
  });

  twilioWs.on("message", (data) => {
    const msg = safeJsonParse(data.toString());
    if (!msg) return;

    if (msg.event === "start") {
      streamSid = msg.start?.streamSid || null;
      return;
    }

    if (msg.event === "media") {
      if (!openaiReady) return;

      const payload = msg.media?.payload;
      if (!payload) return;

      // IMPORTANT: DO NOT commit/create response here.
      // Just continuously append. VAD will decide speech boundaries.
      openaiWs.send(JSON.stringify({ type: "input_audio_buffer.append", audio: payload }));
      return;
    }

    if (msg.event === "stop") {
      try {
        openaiWs.close();
      } catch {}
      try {
        twilioWs.close();
      } catch {}
    }
  });

  twilioWs.on("close", () => {
    try {
      openaiWs.close();
    } catch {}
  });

  twilioWs.on("error", (e) => {
    console.error("Twilio WS error:", e);
    try {
      openaiWs.close();
    } catch {}
  });
});

server.listen(PORT, () => {
  console.log(`Foundzie Bridge listening on :${PORT}`);
});
