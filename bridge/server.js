// bridge/server.js
import http from "http";
import { WebSocketServer, WebSocket } from "ws";

/**
 * Foundzie Twilio <Stream> bridge + OpenAI Realtime + Tool-calling via Vercel endpoint
 *
 * Tool strategy: A) single endpoint per tool
 *   POST { phone, message, roomId?, callSid? } -> /api/tools/call_third_party
 */

const PORT = process.env.PORT || 8080;

// ---- Required ----
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || "").trim();
if (!OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY");
  process.exit(1);
}

// ---- Realtime config ----
const REALTIME_MODEL = (process.env.REALTIME_MODEL || "gpt-4o-realtime-preview").trim();
const REALTIME_VOICE = (process.env.REALTIME_VOICE || "alloy").trim();

const OPENAI_REALTIME_URL = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(
  REALTIME_MODEL
)}`;

// ---- Your app base URL (Vercel) for tool calls ----
const TWILIO_BASE_URL =
  (process.env.TWILIO_BASE_URL || "").trim() ||
  (process.env.NEXT_PUBLIC_SITE_URL || "").trim() ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
  "https://foundzie-v2.vercel.app";

const TOOLS_CALL_THIRD_PARTY_URL =
  (process.env.TOOLS_CALL_THIRD_PARTY_URL || "").trim() ||
  `${TWILIO_BASE_URL.replace(/\/+$/, "")}/api/tools/call_third_party`;

// Optional: protect your tools endpoint with a shared secret
const TOOLS_SECRET = (process.env.TOOLS_SECRET || "").trim();

// ---- Tunables ----
const MIN_MEDIA_FRAMES = Number(process.env.MIN_MEDIA_FRAMES || 10); // ~200ms
const SPEECH_STOP_DEBOUNCE_MS = Number(process.env.SPEECH_STOP_DEBOUNCE_MS || 450);
const VAD_SILENCE_MS = Number(process.env.VAD_SILENCE_MS || 700);

// OpenAI reconnect tuning
const OPENAI_RECONNECT_MAX = Number(process.env.OPENAI_RECONNECT_MAX || 3);
const OPENAI_RECONNECT_DELAY_MS = Number(process.env.OPENAI_RECONNECT_DELAY_MS || 600);

// If OpenAI stays down, we keep Twilio alive. This avoids “call drops”.
const OPENAI_CONNECT_TIMEOUT_MS = Number(process.env.OPENAI_CONNECT_TIMEOUT_MS || 8000);

// ---------------- Utilities ----------------
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

function nowIso() {
  return new Date().toISOString();
}

function summarize(obj, max = 800) {
  try {
    const s = JSON.stringify(obj);
    return s.length > max ? s.slice(0, max) + "…(truncated)" : s;
  } catch {
    return String(obj);
  }
}

// Tool-call HTTP helper
async function callToolCallThirdParty(args) {
  const payload = {
    phone: typeof args?.phone === "string" ? args.phone : "",
    message: typeof args?.message === "string" ? args.message : "",
    roomId: typeof args?.roomId === "string" ? args.roomId : undefined,
    callSid: typeof args?.callSid === "string" ? args.callSid : undefined,
  };

  const headers = {
    "content-type": "application/json",
  };
  if (TOOLS_SECRET) headers["x-foundzie-tools-secret"] = TOOLS_SECRET;

  const r = await fetch(TOOLS_CALL_THIRD_PARTY_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const text = await r.text().catch(() => "");
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return {
    ok: r.ok,
    status: r.status,
    raw: text?.slice(0, 2000) || "",
    json,
  };
}

// ---------------- HTTP server (health) ----------------
const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, now: nowIso() }));
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

// ---------------- WebSocket server ----------------
const wss = new WebSocketServer({ server, path: "/twilio/stream" });

wss.on("connection", (twilioWs) => {
  console.log("[twilio] ws connected");

  // Twilio identifiers (we will log full start event now)
  let streamSid = null;
  let twilioCallSid = null;
  let roomId = null;

  // OpenAI socket + state
  let openaiWs = null;
  let openaiReady = false;
  let openaiConnecting = false;
  let openaiReconnects = 0;

  // Response control
  let responseInProgress = false;
  let mediaFramesSinceLastResponse = 0;
  let greeted = false;
  let pendingResponseTimer = null;

  // Tool-call state (avoid double-running the same call_id)
  const handledToolCallIds = new Set();

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

  // ---------------- OpenAI handlers ----------------
  function attachOpenAiHandlers(ws) {
    ws.on("open", () => {
      openaiReady = true;
      openaiConnecting = false;

      // 1) session.update with tools enabled
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
            "Do not mention being an AI unless asked. " +
            "If the caller asks you to call a third party and deliver a message, use the call_third_party tool.",
          tools: [
            {
              type: "function",
              name: "call_third_party",
              description:
                "Call a third-party phone number and deliver a short spoken message. Use when asked: 'call X and tell them Y'.",
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

      // --- Audio from OpenAI -> Twilio ---
      if (msg.type === "response.audio.delta" && msg.delta && streamSid) {
        wsSend(twilioWs, {
          event: "media",
          streamSid,
          media: { payload: msg.delta },
        });
        return;
      }

      // --- Tool calls (Realtime function calling) ---
      // We handle common Realtime shapes safely. If OpenAI sends a tool call, it will include:
      // - a call_id (or id)
      // - a name
      // - arguments (stringified JSON) OR argument deltas that eventually complete
      //
      // We support both:
      //  1) msg.type === "response.function_call_arguments.done"
      //  2) msg.type === "response.tool_call_arguments.done"
      //  3) msg.type === "response.function_call" with arguments
      //
      const toolDoneTypes = new Set([
        "response.function_call_arguments.done",
        "response.tool_call_arguments.done",
      ]);

      if (toolDoneTypes.has(msg.type)) {
        const callId = msg.call_id || msg.id || msg.item_id || null;
        const name = msg.name || msg.tool_name || msg.function_name || null;
        const argsText = msg.arguments || msg.args || msg.tool_arguments || "";

        if (!callId || !name) return;
        if (handledToolCallIds.has(callId)) return;
        handledToolCallIds.add(callId);

        let args = safeJsonParse(argsText);
        if (!args) args = {};

        // Inject call context so tool can bridge if needed
        if (!args.roomId && roomId) args.roomId = roomId;
        if (!args.callSid && twilioCallSid) args.callSid = twilioCallSid;

        console.log("[tool] received", { name, callId, args: summarize(args, 500) });

        let toolResult = { ok: false, message: "Unknown tool." };

        try {
          if (name === "call_third_party") {
            const res = await callToolCallThirdParty(args);
            toolResult = {
              ok: res.ok,
              status: res.status,
              response: res.json || null,
              raw: res.json ? undefined : res.raw,
            };
          }
        } catch (e) {
          toolResult = { ok: false, message: "Tool call failed.", error: String(e) };
        }

        // Send tool output back to OpenAI
        // Realtime supports conversation item create with function_call_output.
        wsSend(openaiWs, {
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: callId,
            output: JSON.stringify(toolResult),
          },
        });

        // Then ask model to speak confirmation to the caller
        wsSend(openaiWs, {
          type: "response.create",
          response: {
            instructions:
              "Confirm to the caller in ONE short sentence what happened. If it failed, ask ONE short question to fix it.",
          },
        });

        return;
      }

      // --- Response lifecycle flags ---
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

      // --- VAD says user stopped speaking -> create response (guarded + debounced) ---
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
        console.error("[openai] error:", summarize(msg, 1200));
        return;
      }

      if (msg.type === "session.created" || msg.type === "session.updated") {
        tryGreet();
        return;
      }
    });

    ws.on("close", () => {
      console.log("[openai] closed");

      // DO NOT shutdown Twilio when OpenAI closes
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
      // close handler will attempt reconnect
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

      // Safety: if it never opens, allow reconnect
      const t = setTimeout(() => {
        if (closed) return;
        if (!openaiWs) return;
        if (openaiReady) return;
        if (openaiWs.readyState === WebSocket.CONNECTING) {
          try {
            console.error("[openai] connect timeout; closing to trigger reconnect");
            openaiWs.close();
          } catch {}
        }
      }, OPENAI_CONNECT_TIMEOUT_MS);

      openaiWs.on("open", () => clearTimeout(t));
      openaiWs.on("close", () => clearTimeout(t));
      openaiWs.on("error", () => clearTimeout(t));

      attachOpenAiHandlers(openaiWs);
    } catch (e) {
      openaiConnecting = false;
      console.error("[openai] connect error:", e);
    }
  }

  // Start OpenAI
  connectOpenAi();

  // ---------------- Twilio inbound ----------------
  twilioWs.on("message", (data) => {
    const msg = safeJsonParse(data.toString());
    if (!msg) return;

    if (msg.event === "start") {
      streamSid = msg.start?.streamSid || null;

      // IMPORTANT: log the FULL start event so we can see customParameters
      console.log("[twilio] start event full:", JSON.stringify(msg, null, 2));

      // Try to extract callSid + roomId if Twilio provides them
      // Twilio typically has msg.start.callSid, and optionally msg.start.customParameters
      const cp = msg.start?.customParameters || {};
      twilioCallSid =
        msg.start?.callSid ||
        cp.callSid ||
        cp.callsid ||
        twilioCallSid ||
        null;

      roomId = cp.roomId || cp.roomid || roomId || null;

      console.log("[twilio] start streamSid=", streamSid, "callSid=", twilioCallSid, "roomId=", roomId);

      tryGreet();
      return;
    }

    if (msg.event === "media") {
      const payload = msg.media?.payload;
      if (!payload) return;

      // Still allow Twilio audio to keep flowing even while OpenAI reconnects (we just drop audio until ready)
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
  console.log("[bridge] tools endpoint:", TOOLS_CALL_THIRD_PARTY_URL);
});
