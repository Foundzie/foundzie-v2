// src/app/api/twilio/voice/route.ts
import { NextRequest, NextResponse } from "next/server";

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

  // If you don't set TWILIO_BASE_URL, you can accidentally end up on a protected preview URL.
  // Strongly recommended to always set TWILIO_BASE_URL in Vercel.
  const nextPublic = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (nextPublic) return nextPublic.replace(/\/+$/, "");

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl.replace(/\/+$/, "")}`;

  return "https://foundzie-v2.vercel.app";
}

function buildGatherFallbackTwiml(marker: string) {
  const base = getBaseUrl();
  const gatherUrl = `${base}/api/twilio/gather`;
  const voiceUrl = `${base}/api/twilio/voice`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <!-- FOUNDZIE_FALLBACK ${escapeForXml(marker)} -->
  <Gather input="speech" action="${escapeForXml(gatherUrl)}" method="POST" timeout="7" speechTimeout="auto">
    <Say voice="alice">Hi, this is Foundzie. Tell me what you need help with.</Say>
  </Gather>
  <Say voice="alice">I didn’t hear anything. Let’s try again.</Say>
  <Redirect method="POST">${escapeForXml(voiceUrl)}</Redirect>
</Response>`;
}

function buildStreamTwiml(opts: {
  marker: string;
  roomId?: string;
  callSid?: string;
  from?: string;
}) {
  const wss = (process.env.TWILIO_MEDIA_STREAM_WSS_URL || "").trim();
  const base = getBaseUrl();

  if (!wss) {
    return buildGatherFallbackTwiml(`${opts.marker} wss=EMPTY`);
  }

  const safeRoom = escapeForXml((opts.roomId || "").trim());
  const safeCallSid = escapeForXml((opts.callSid || "").trim());
  const safeFrom = escapeForXml((opts.from || "").trim());

  // STREAM first. No <Say> here (avoid Twilio TTS if streaming works).
  // If the stream ends, Twilio will continue and execute the fallback redirect.
  const fallback = buildGatherFallbackTwiml(`${opts.marker} fallback=gather`).replace(
    `<?xml version="1.0" encoding="UTF-8"?>`,
    ""
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <!-- FOUNDZIE_STREAM ${escapeForXml(opts.marker)} -->
  <Connect>
    <Stream url="${escapeForXml(wss)}">
      <Parameter name="source" value="twilio-media-streams" />
      <Parameter name="base" value="${escapeForXml(base)}" />
      ${safeRoom ? `<Parameter name="roomId" value="${safeRoom}" />` : ``}
      ${safeCallSid ? `<Parameter name="callSid" value="${safeCallSid}" />` : ``}
      ${safeFrom ? `<Parameter name="from" value="${safeFrom}" />` : ``}
    </Stream>
  </Connect>

  ${fallback}
</Response>`;
}

export async function GET(req: NextRequest) {
  // Debug GET (browser): shows stream TwiML
  const sha =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_GITHUB_COMMIT_SHA ||
    "sha-unknown";

  const wssPresent = !!(process.env.TWILIO_MEDIA_STREAM_WSS_URL || "").trim();
  const marker = `mode=STREAM sha=${sha} wssPresent=${wssPresent} method=GET`;

  const url = new URL(req.url);
  const roomId = (url.searchParams.get("roomId") || "").trim();

  return twiml(
    buildStreamTwiml({
      marker,
      roomId: roomId || undefined,
    })
  );
}

export async function POST(req: NextRequest) {
  const sha =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_GITHUB_COMMIT_SHA ||
    "sha-unknown";

  const wssPresent = !!(process.env.TWILIO_MEDIA_STREAM_WSS_URL || "").trim();

  // Twilio hits this as application/x-www-form-urlencoded
  const form = await req.formData().catch(() => null);
  const callSidRaw = form ? form.get("CallSid") : null;
  const fromRaw = form ? form.get("From") : null;

  const callSid = typeof callSidRaw === "string" ? callSidRaw.trim() : "";
  const from = typeof fromRaw === "string" ? fromRaw.trim() : "";

  // Use CallSid as roomId to keep each call isolated unless you want phone-based continuity.
  const roomId = callSid ? `call:${callSid}` : from ? `phone:${from}` : undefined;

  const marker = `mode=STREAM sha=${sha} wssPresent=${wssPresent} method=POST`;

  return twiml(
    buildStreamTwiml({
      marker,
      roomId,
      callSid,
      from,
    })
  );
}
