// src/app/api/twilio/voice/route.ts
import { NextRequest, NextResponse } from "next/server";
import { kvSetJSON } from "@/lib/kv/redis";

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

  const nextPublic = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (nextPublic) return nextPublic.replace(/\/+$/, "");

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl.replace(/\/+$/, "")}`;

  return "https://foundzie-v2.vercel.app";
}

// Fallback voice (Twilio TTS). Still not as good as realtime stream,
// but MUCH more human than "alice".
const FALLBACK_TTS_VOICE =
  (process.env.TWILIO_FALLBACK_VOICE || "").trim() || "Polly.Joanna-Neural";

function buildGatherFallbackVerbs(marker: string) {
  const base = getBaseUrl();
  const gatherUrl = `${base}/api/twilio/gather`;
  const voiceUrl = `${base}/api/twilio/voice`;

  return `
  <!-- FOUNDZIE_FALLBACK ${escapeForXml(marker)} -->
  <Gather input="speech" action="${escapeForXml(gatherUrl)}" method="POST" timeout="7" speechTimeout="auto">
    <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">Hi, this is Foundzie. How can I help?</Say>
  </Gather>
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">I didn’t catch that. Let’s try again.</Say>
  <Redirect method="POST">${escapeForXml(voiceUrl)}</Redirect>
  `.trim();
}

function buildStreamTwiml(opts: {
  marker: string;
  roomId?: string;
  callSid?: string;
  from?: string;
}) {
  const wss = (process.env.TWILIO_MEDIA_STREAM_WSS_URL || "").trim();
  const base = getBaseUrl();

  const safeRoom = escapeForXml((opts.roomId || "").trim());
  const safeCallSid = escapeForXml((opts.callSid || "").trim());
  const safeFrom = escapeForXml((opts.from || "").trim());

  // If no WSS configured, go straight to Gather flow (single Response)
  if (!wss) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${buildGatherFallbackVerbs(`${opts.marker} wss=EMPTY`)}
</Response>`;
  }

  // STREAM first. If stream ends immediately, Twilio continues to fallback verbs.
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

  ${buildGatherFallbackVerbs(`${opts.marker} fallback=gather`)}
</Response>`;
}

function activeCallKey(roomId: string) {
  return `foundzie:twilio:active-call:${roomId}:v1`;
}

async function persistActiveCall(roomId: string, callSid: string, from: string) {
  if (!roomId || !callSid) return;
  try {
    await kvSetJSON(activeCallKey(roomId), {
      roomId,
      callSid,
      from,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    // non-fatal
    console.warn("[twilio/voice] failed to persist active call mapping", e);
  }
}

export async function GET(req: NextRequest) {
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

  const url = new URL(req.url);
  const roomIdFromQuery = (url.searchParams.get("roomId") || "").trim();

  const form = await req.formData().catch(() => null);
  const callSidRaw = form ? form.get("CallSid") : null;
  const fromRaw = form ? form.get("From") : null;

  const callSid = typeof callSidRaw === "string" ? callSidRaw.trim() : "";
  const from = typeof fromRaw === "string" ? fromRaw.trim() : "";

  // ✅ Prefer explicit roomId when provided by the app (outbound call route)
  const roomId =
    roomIdFromQuery ||
    (callSid ? `call:${callSid}` : from ? `phone:${from}` : "");

  // Persist active call mapping for M14 (safe, non-breaking)
  await persistActiveCall(roomId, callSid, from);

  const marker = `mode=STREAM sha=${sha} wssPresent=${wssPresent} method=POST`;

  return twiml(
    buildStreamTwiml({
      marker,
      roomId: roomId || undefined,
      callSid,
      from,
    })
  );
}
