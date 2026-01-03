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

function buildMessageTwiml(message: string, roomId?: string) {
  const base = getBaseUrl();
  const safe = escapeForXml((message || "").trim().slice(0, 900));

  // ✅ Speak message, then immediately resume the realtime stream (do NOT hang up)
  const resumeUrl = `${base}/api/twilio/voice${
    roomId ? `?roomId=${encodeURIComponent(roomId)}` : ""
  }`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">${safe}</Say>
  <Redirect method="POST">${escapeForXml(resumeUrl)}</Redirect>
</Response>`;
}

function buildGatherFallbackVerbs(marker: string) {
  const base = getBaseUrl();
  const gatherUrl = `${base}/api/twilio/gather`;
  const voiceUrl = `${base}/api/twilio/voice`;

  return `
  <!-- FOUNDZIE_FALLBACK ${escapeForXml(marker)} -->
  <Gather input="speech" action="${escapeForXml(
    gatherUrl
  )}" method="POST" timeout="7" speechTimeout="auto">
    <Say voice="${escapeForXml(
      FALLBACK_TTS_VOICE
    )}">Hi, this is Foundzie. How can I help?</Say>
  </Gather>
  <Say voice="${escapeForXml(
    FALLBACK_TTS_VOICE
  )}">I didn’t catch that. Let’s try again.</Say>
  <Redirect method="POST">${escapeForXml(voiceUrl)}</Redirect>
  `.trim();
}

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

  // IMPORTANT: This endpoint expects real call status webhooks.
  // Stream status callbacks (if any) may not match. So we do NOT rely on them.
  const statusCb = `${base}/api/twilio/status`;

  if (!wss) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${buildGatherFallbackVerbs(`${opts.marker} wss=EMPTY`)}
</Response>`;
  }

  const gatherFallbackUrl = `${base}/api/twilio/gather`;

  // ✅ Key fix:
  // - Do NOT <Hangup/> after <Connect><Stream>.
  // - If stream fails or ends, fall back into Gather so the call stays alive + conversational.
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

  <!-- If the Stream cannot connect or ends, keep the call alive and switch to speech fallback -->
  <Redirect method="POST">${escapeForXml(gatherFallbackUrl)}</Redirect>
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

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const mode = (url.searchParams.get("mode") || "").trim();
  const say = (url.searchParams.get("say") || "").trim();
  const roomId = (url.searchParams.get("roomId") || "").trim();

  if (mode === "message" && say) {
    return twiml(buildMessageTwiml(say, roomId || undefined));
  }

  const sha =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_GITHUB_COMMIT_SHA ||
    "sha-unknown";

  const wss = (process.env.TWILIO_MEDIA_STREAM_WSS_URL || "").trim();
  const marker = `mode=STREAM sha=${sha} wss=${wss ? "SET" : "EMPTY"} method=GET`;

  return twiml(
    buildStreamOnlyTwiml({
      marker,
      roomId: roomId || undefined,
    })
  );
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);

  const mode = (url.searchParams.get("mode") || "").trim();
  const say = (url.searchParams.get("say") || "").trim();
  const roomIdFromQuery = (url.searchParams.get("roomId") || "").trim();

  if (mode === "message" && say) {
    return twiml(buildMessageTwiml(say, roomIdFromQuery || undefined));
  }

  const sha =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_GITHUB_COMMIT_SHA ||
    "sha-unknown";

  const wss = (process.env.TWILIO_MEDIA_STREAM_WSS_URL || "").trim();
  const marker = `mode=STREAM sha=${sha} wss=${wss ? "SET" : "EMPTY"} method=POST`;

  const form = await req.formData().catch(() => null);
  const callSidRaw = form ? form.get("CallSid") : null;
  const fromRaw = form ? form.get("From") : null;

  const callSid = typeof callSidRaw === "string" ? callSidRaw.trim() : "";
  const from = typeof fromRaw === "string" ? fromRaw.trim() : "";

  const roomId =
    roomIdFromQuery ||
    (callSid ? `call:${callSid}` : from ? `phone:${from}` : "");

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
