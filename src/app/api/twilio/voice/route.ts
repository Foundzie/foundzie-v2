// src/app/api/twilio/voice/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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

function getBaseUrl(): string | null {
  const explicit = process.env.TWILIO_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl.replace(/\/+$/, "")}`;

  const nextPublic = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (nextPublic) return nextPublic.replace(/\/+$/, "");

  return null;
}

function buildGatherTwiml() {
  const base = getBaseUrl();
  const gatherUrl = base ? `${base}/api/twilio/gather` : `/api/twilio/gather`;
  const voiceUrl = base ? `${base}/api/twilio/voice` : `/api/twilio/voice`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather
    input="speech"
    action="${gatherUrl}"
    method="POST"
    timeout="7"
    speechTimeout="auto"
  >
    <Say voice="alice">
      Hi, this is Foundzie. Tell me what you need help with.
    </Say>
  </Gather>
  <Say voice="alice">I didn’t hear anything. Let’s try again.</Say>
  <Redirect method="POST">${voiceUrl}</Redirect>
</Response>`;
}

function buildStreamTwiml(req: Request) {
  const wss = (process.env.TWILIO_MEDIA_STREAM_WSS_URL || "").trim();
  if (!wss) return buildGatherTwiml();

  const url = new URL(req.url);
  const roomId = (url.searchParams.get("roomId") || "").trim();
  const safeRoom = escapeForXml(roomId);

  // IMPORTANT:
  // No <Say> here — that “robot” voice is Twilio.
  // We want OpenAI to do the greeting from the bridge.
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${escapeForXml(wss)}" track="inbound_track">
      ${safeRoom ? `<Parameter name="roomId" value="${safeRoom}" />` : ``}
      <Parameter name="source" value="twilio-media-streams" />
    </Stream>
  </Connect>

  <!-- If stream ends, fall back to Gather -->
  ${buildGatherTwiml().replace(`<?xml version="1.0" encoding="UTF-8"?>`, "")}
</Response>`;
}

export async function GET(req: Request) {
  return POST(req);
}

export async function POST(req: Request) {
  return twiml(buildStreamTwiml(req));
}
