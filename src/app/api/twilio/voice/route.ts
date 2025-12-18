// src/app/api/twilio/voice/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function twiml(xml: string) {
  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

function json(data: any) {
  return NextResponse.json(data, { status: 200 });
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

function shouldUseStreams() {
  const flag = (process.env.TWILIO_USE_MEDIA_STREAMS || "").trim().toLowerCase();
  const wss = (process.env.TWILIO_MEDIA_STREAM_WSS_URL || "").trim();
  const enabled = flag === "1" || flag === "true" || flag === "yes" || flag === "on";
  return { enabled, wss, ok: enabled && !!wss };
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
  const { ok, wss } = shouldUseStreams();
  if (!ok) return buildGatherTwiml();

  const url = new URL(req.url);
  const roomId = (url.searchParams.get("roomId") || "").trim();
  const safeRoom = escapeForXml(roomId);

  // IMPORTANT:
  // No <Say> here — that "robot voice" is Twilio.
  // The OpenAI Realtime bridge should do the greeting.
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${escapeForXml(wss)}" track="inbound_track">
      ${safeRoom ? `<Parameter name="roomId" value="${safeRoom}" />` : ``}
      <Parameter name="source" value="twilio-media-streams" />
    </Stream>
  </Connect>

  <!-- If stream ends unexpectedly, fall back to Gather -->
  ${buildGatherTwiml().replace(`<?xml version="1.0" encoding="UTF-8"?>`, "")}
</Response>`;
}

export async function GET(req: Request) {
  // Debug: open in browser to confirm env vars are actually present in PROD runtime
  const url = new URL(req.url);
  if (url.searchParams.get("debug") === "1") {
    const base = getBaseUrl();
    const { enabled, ok, wss } = shouldUseStreams();
    return json({
      ok: true,
      mode: ok ? "stream" : "gather",
      streamsEnabledFlag: enabled,
      hasWssUrl: !!wss,
      wssPreview: wss ? `${wss.slice(0, 22)}…${wss.slice(-10)}` : null,
      baseUrl: base,
      vercelUrl: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    });
  }

  return POST(req);
}

export async function POST(req: Request) {
  return twiml(buildStreamTwiml(req));
}
