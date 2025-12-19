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

function getBaseUrl(): string {
  const explicit = process.env.TWILIO_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl.replace(/\/+$/, "")}`;

  const nextPublic = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (nextPublic) return nextPublic.replace(/\/+$/, "");

  return "https://foundzie-v2.vercel.app"; // safe fallback
}

function buildGatherTwiml(marker: string) {
  const base = getBaseUrl();
  const gatherUrl = `${base}/api/twilio/gather`;
  const voiceUrl = `${base}/api/twilio/voice`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <!-- FOUNDZIE_VOICE_MARKER ${escapeForXml(marker)} -->
  <Gather input="speech" action="${escapeForXml(gatherUrl)}" method="POST" timeout="7" speechTimeout="auto">
    <Say voice="alice">Hi, this is Foundzie. Tell me what you need help with.</Say>
  </Gather>
  <Say voice="alice">I didn’t hear anything. Let’s try again.</Say>
  <Redirect method="POST">${escapeForXml(voiceUrl)}</Redirect>
</Response>`;
}

function buildStreamTwiml(req: Request, marker: string) {
  const wss = (process.env.TWILIO_MEDIA_STREAM_WSS_URL || "").trim();
  const base = getBaseUrl();

  // No WSS -> cannot stream
  if (!wss) return buildGatherTwiml(marker + " wss=EMPTY");

  const url = new URL(req.url);
  const roomId = (url.searchParams.get("roomId") || "").trim();
  const safeRoom = escapeForXml(roomId);

  // IMPORTANT: no <Say> here (Twilio voice sounds robotic).
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <!-- FOUNDZIE_VOICE_MARKER ${escapeForXml(marker)} -->
  <Connect>
    <Stream url="${escapeForXml(wss)}">
      ${safeRoom ? `<Parameter name="roomId" value="${safeRoom}" />` : ``}
      <Parameter name="source" value="twilio-media-streams" />
      <Parameter name="base" value="${escapeForXml(base)}" />
    </Stream>
  </Connect>

  <!-- If stream ends, fall back to Gather -->
  ${buildGatherTwiml(marker + " fallback=gather").replace(`<?xml version="1.0" encoding="UTF-8"?>`, "")}
</Response>`;
}

export async function GET(req: Request) {
  return POST(req);
}

export async function POST(req: Request) {
  const sha =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_GITHUB_COMMIT_SHA ||
    "sha-unknown";

  const wssPresent = !!(process.env.TWILIO_MEDIA_STREAM_WSS_URL || "").trim();
  const marker = `mode=STREAM sha=${sha} wssPresent=${wssPresent}`;

  return twiml(buildStreamTwiml(req, marker));
}
