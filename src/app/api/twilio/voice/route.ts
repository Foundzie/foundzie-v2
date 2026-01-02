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

const FALLBACK_TTS_VOICE =
  (process.env.TWILIO_FALLBACK_VOICE || "").trim() || "Polly.Joanna-Neural";

function buildStreamOnlyTwiml(opts: {
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

  const statusCb = `${base}/api/twilio/status`;

  if (!wss) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">Voice streaming is not configured.</Say>
  <Hangup/>
</Response>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <!-- FOUNDZIE_STREAM ${escapeForXml(opts.marker)} -->
  <Connect>
    <Stream url="${escapeForXml(wss)}"
            statusCallback="${escapeForXml(statusCb)}"
            statusCallbackMethod="POST">
      <Parameter name="source" value="twilio-media-streams" />
      <Parameter name="base" value="${escapeForXml(base)}" />
      ${safeRoom ? `<Parameter name="roomId" value="${safeRoom}" />` : ``}
      ${safeCallSid ? `<Parameter name="callSid" value="${safeCallSid}" />` : ``}
      ${safeFrom ? `<Parameter name="from" value="${safeFrom}" />` : ``}
    </Stream>
  </Connect>
</Response>`;
}

function activeCallKey(roomId: string) {
  return `foundzie:twilio:active-call:${roomId}:v1`;
}
const LAST_ACTIVE_KEY = "foundzie:twilio:last-active-call:v1";

async function persistActiveCall(roomId: string, callSid: string, from: string) {
  if (!roomId || !callSid) return;

  const payload = {
    roomId,
    callSid,
    from,
    updatedAt: new Date().toISOString(),
  };

  try {
    await kvSetJSON(activeCallKey(roomId), payload);
  } catch (e) {
    console.warn("[twilio/voice] failed to persist active call mapping", e);
  }

  try {
    await kvSetJSON(LAST_ACTIVE_KEY, payload);
  } catch (e) {
    console.warn("[twilio/voice] failed to persist last active call pointer", e);
  }
}

/**
 * GET /api/twilio/voice
 * - mode=message&say=... -> speak message THEN return to Stream (no hangup)
 * - otherwise -> Stream-first TwiML
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const mode = (url.searchParams.get("mode") || "").trim();
  const say = (url.searchParams.get("say") || "").trim();

  const sha =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_GITHUB_COMMIT_SHA ||
    "sha-unknown";

  const wss = (process.env.TWILIO_MEDIA_STREAM_WSS_URL || "").trim();

  // ✅ message mode: say then return to streaming
  if (mode === "message" && say) {
    const roomId = (url.searchParams.get("roomId") || "").trim();
    const marker = `mode=MESSAGE->STREAM sha=${sha} wss=${wss ? "SET" : "EMPTY"} method=GET`;

    return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">${escapeForXml(say.slice(0, 900))}</Say>
  ${buildStreamOnlyTwiml({ marker, roomId: roomId || undefined })}
</Response>`);
  }

  const marker = `mode=STREAM sha=${sha} wss=${wss ? "SET" : "EMPTY"} method=GET`;
  const roomId = (url.searchParams.get("roomId") || "").trim();

  return twiml(buildStreamOnlyTwiml({ marker, roomId: roomId || undefined }));
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);

  const mode = (url.searchParams.get("mode") || "").trim();
  const say = (url.searchParams.get("say") || "").trim();

  const sha =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_GITHUB_COMMIT_SHA ||
    "sha-unknown";

  const wss = (process.env.TWILIO_MEDIA_STREAM_WSS_URL || "").trim();

  // ✅ message mode: say then return to streaming
  if (mode === "message" && say) {
    const roomId = (url.searchParams.get("roomId") || "").trim();
    const marker = `mode=MESSAGE->STREAM sha=${sha} wss=${wss ? "SET" : "EMPTY"} method=POST`;

    return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">${escapeForXml(say.slice(0, 900))}</Say>
  ${buildStreamOnlyTwiml({ marker, roomId: roomId || undefined })}
</Response>`);
  }

  const marker = `mode=STREAM sha=${sha} wss=${wss ? "SET" : "EMPTY"} method=POST`;

  const roomIdFromQuery = (url.searchParams.get("roomId") || "").trim();
  const form = await req.formData().catch(() => null);

  const callSidRaw = form ? form.get("CallSid") : null;
  const fromRaw = form ? form.get("From") : null;

  const callSid = typeof callSidRaw === "string" ? callSidRaw.trim() : "";
  const from = typeof fromRaw === "string" ? fromRaw.trim() : "";

  const roomId =
    roomIdFromQuery || (callSid ? `call:${callSid}` : from ? `phone:${from}` : "");

  await persistActiveCall(roomId, callSid, from);

  return twiml(
    buildStreamOnlyTwiml({
      marker,
      roomId: roomId || undefined,
      callSid,
      from,
    })
  );
}
