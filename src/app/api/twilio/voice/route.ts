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

  const nextPublic = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (nextPublic) return nextPublic.replace(/\/+$/, "");

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl.replace(/\/+$/, "")}`;

  return null;
}

function streamDecision() {
  const flag = (process.env.TWILIO_USE_MEDIA_STREAMS || "").trim().toLowerCase();
  const enabled = flag === "1" || flag === "true" || flag === "yes" || flag === "on";
  const wss = (process.env.TWILIO_MEDIA_STREAM_WSS_URL || "").trim();
  return { enabled, wss, ok: enabled && !!wss };
}

function buildGatherTwiml(marker: string) {
  const base = getBaseUrl();
  const gatherUrl = base ? `${base}/api/twilio/gather` : `/api/twilio/gather`;
  const voiceUrl = base ? `${base}/api/twilio/voice` : `/api/twilio/voice`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${marker}
  <Gather input="speech" action="${gatherUrl}" method="POST" timeout="7" speechTimeout="auto">
    <Say voice="alice">Hi, this is Foundzie. Tell me what you need help with.</Say>
  </Gather>
  <Say voice="alice">I didn’t hear anything. Let’s try again.</Say>
  <Redirect method="POST">${voiceUrl}</Redirect>
</Response>`;
}

function buildStreamTwiml(req: Request, marker: string) {
  const { ok, wss } = streamDecision();
  if (!ok) return buildGatherTwiml(marker);

  const url = new URL(req.url);
  const roomId = (url.searchParams.get("roomId") || "").trim();
  const safeRoom = escapeForXml(roomId);

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${marker}
  <Connect>
    <Stream url="${escapeForXml(wss)}">
      ${safeRoom ? `<Parameter name="roomId" value="${safeRoom}" />` : ``}
      <Parameter name="source" value="twilio-media-streams" />
    </Stream>
  </Connect>
</Response>`;
}

export async function GET(req: Request) {
  return POST(req);
}

export async function POST(req: Request) {
  const { enabled, ok, wss } = streamDecision();
  const commit =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_REF ||
    "no-vercel-commit-env";

  const wssPreview = wss ? `${wss.slice(0, 20)}…${wss.slice(-12)}` : "EMPTY";
  const marker = `<!-- FOUNDZIE_MARKER commit=${commit} streamsEnabled=${enabled} streamOK=${ok} wss=${wssPreview} -->`;

  return twiml(buildStreamTwiml(req, marker));
}
