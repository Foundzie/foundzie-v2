// src/app/api/twilio/voice/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Modes:
 * - Gather mode (default): classic <Gather> loop to /api/twilio/gather (your current working flow)
 * - Stream mode (M9e-C): <Connect><Stream> to a WebSocket bridge that talks to OpenAI Realtime (speech-to-speech)
 *
 * Env:
 * - TWILIO_USE_MEDIA_STREAMS=1          (optional toggle)
 * - TWILIO_MEDIA_STREAM_WSS_URL=wss://.../twilio/stream   (required for stream mode)
 * - TWILIO_BASE_URL=https://your-app.vercel.app           (recommended)
 * - TWILIO_VOICE_URL=https://.../api/twilio/voice         (optional)
 */

function getBaseUrl(): string | null {
  const explicit = process.env.TWILIO_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const voiceUrl = process.env.TWILIO_VOICE_URL?.trim();
  if (voiceUrl) {
    try {
      const u = new URL(voiceUrl);
      return `${u.protocol}//${u.host}`;
    } catch {
      // ignore
    }
  }

  const nextPublic = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (nextPublic) return nextPublic.replace(/\/+$/, "");

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl.replace(/\/+$/, "")}`;

  return null;
}

function twiml(xml: string) {
  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

function escapeForXml(text: string): string {
  return (text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function shouldUseStreams() {
  const flag = (process.env.TWILIO_USE_MEDIA_STREAMS || "").trim();
  const wss = (process.env.TWILIO_MEDIA_STREAM_WSS_URL || "").trim();
  return (flag === "1" || flag.toLowerCase() === "true") && !!wss;
}

function buildGatherTwiml() {
  const base = getBaseUrl();

  const gatherUrl = base ? `${base}/api/twilio/gather` : `/api/twilio/gather`;
  const voiceUrl = base ? `${base}/api/twilio/voice` : `/api/twilio/voice`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather
    input="speech"
    action="${gatherUrl}"
    method="POST"
    timeout="7"
    speechTimeout="auto"
  >
    <Say voice="alice">
      Hi, this is Foundzie, your personal concierge.
      Tell me what you need, and I will help you right now.
    </Say>
  </Gather>

  <Say voice="alice">
    I did not hear anything. Let’s try again.
  </Say>
  <Redirect method="POST">${voiceUrl}</Redirect>
</Response>`;

  return xml;
}

function buildStreamTwiml(req: Request) {
  const wss = (process.env.TWILIO_MEDIA_STREAM_WSS_URL || "").trim();

  // Twilio will connect to this WSS and start sending audio frames.
  // We pass a few helpful values as <Parameter> so the bridge can map CallSid → roomId, etc.
  const url = new URL(req.url);
  const roomId = (url.searchParams.get("roomId") || "").trim();

  const safeRoom = escapeForXml(roomId);

  // Important: Twilio supports <Connect><Stream>. The bridge must speak Twilio’s Media Streams JSON protocol.
  // We still include a friendly intro line so the caller knows they’re connected.
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">One moment — connecting you to Foundzie.</Say>
  <Connect>
    <Stream url="${escapeForXml(wss)}">
      ${
        safeRoom
          ? `<Parameter name="roomId" value="${safeRoom}" />`
          : ``
      }
      <Parameter name="source" value="twilio-media-streams" />
    </Stream>
  </Connect>

  <!-- If the stream ends unexpectedly, fall back to Gather mode -->
  ${buildGatherTwiml().replace(`<?xml version="1.0" encoding="UTF-8"?>`, "")}
</Response>`;
}

export async function GET(req: Request) {
  return POST(req);
}

export async function POST(req: Request) {
  if (shouldUseStreams()) {
    return twiml(buildStreamTwiml(req));
  }
  return twiml(buildGatherTwiml());
}
