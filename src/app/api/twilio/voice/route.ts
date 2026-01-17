// src/app/api/twilio/voice/route.ts
import { NextRequest, NextResponse } from "next/server";
import { kvSetJSON } from "@/lib/kv/redis";
import { getLastLocation } from "@/app/api/location/store";

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

/**
 * Speak a short message (TTS) then resume the caller realtime stream.
 * IMPORTANT: We redirect back to /api/twilio/voice (caller stream), not hangup.
 */
function buildMessageTwiml(message: string, roomId?: string) {
  const base = getBaseUrl();
  const safe = escapeForXml((message || "").trim().slice(0, 900));

  const resumeUrl = `${base}/api/twilio/voice${
    roomId
      ? `?roomId=${encodeURIComponent(roomId)}&mode=caller_stream`
      : `?mode=caller_stream`
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
  const voiceUrl = `${base}/api/twilio/voice?mode=caller_stream`;

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

type Mode = "caller_stream" | "callee_stream" | "message";
type Role = "caller" | "callee";

type StreamTwimlOpts = {
  marker: string;
  roomId?: string;
  callSid?: string;
  from?: string;

  mode: Mode;
  role: Role;

  sessionId?: string;
  callerCallSid?: string;

  task?: string;
  calleeType?: "personal" | "business";

  // ✅ M20
  location?: {
    lat: number;
    lng: number;
    accuracy?: number | null;
    updatedAt?: string;
  } | null;
};

function buildStreamOnlyTwiml(opts: StreamTwimlOpts) {
  const wss = (process.env.TWILIO_MEDIA_STREAM_WSS_URL || "").trim();
  const base = getBaseUrl();

  const safeRoom = escapeForXml((opts.roomId || "").trim());
  const safeCallSid = escapeForXml((opts.callSid || "").trim());
  const safeFrom = escapeForXml((opts.from || "").trim());

  const safeMode = escapeForXml(opts.mode);
  const safeRole = escapeForXml(opts.role);

  const calleeType = (opts.calleeType || "personal").trim() as
    | "personal"
    | "business";
  const safeCalleeType = escapeForXml(calleeType);

  const sessionId =
    (opts.sessionId || "").trim() ||
    `m16_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const callerCallSid = (opts.callerCallSid || "").trim();

  const safeSessionId = escapeForXml(sessionId);
  const safeCallerCallSid = escapeForXml(callerCallSid);

  const task = (opts.task || "").trim().slice(0, 900);
  const safeTask = escapeForXml(task);

  const statusCb = `${base}/api/twilio/status`;

  if (!wss) {
    if (opts.role === "callee") {
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">
    Sorry — voice streaming is temporarily unavailable. Goodbye.
  </Say>
  <Hangup/>
</Response>`;
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${buildGatherFallbackVerbs(`${opts.marker} wss=EMPTY`)}
</Response>`;
  }

  const gatherFallbackUrl = `${base}/api/twilio/gather`;

  const afterStream =
    opts.role === "callee"
      ? `<Hangup/>`
      : `<Redirect method="POST">${escapeForXml(gatherFallbackUrl)}</Redirect>`;

  const loc = opts.location ?? null;
  const locLat = loc ? String(loc.lat) : "";
  const locLng = loc ? String(loc.lng) : "";
  const locAcc = loc && loc.accuracy != null ? String(loc.accuracy) : "";
  const locUpdated = loc && loc.updatedAt ? String(loc.updatedAt) : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <!-- FOUNDZIE_STREAM ${escapeForXml(opts.marker)} mode=${safeMode} role=${safeRole} -->
  <Connect>
    <Stream url="${escapeForXml(wss)}"
            statusCallback="${escapeForXml(statusCb)}"
            statusCallbackMethod="POST">
      <Parameter name="source" value="twilio-media-streams" />
      <Parameter name="base" value="${escapeForXml(base)}" />

      <Parameter name="mode" value="${safeMode}" />
      <Parameter name="role" value="${safeRole}" />
      <Parameter name="calleeType" value="${safeCalleeType}" />

      ${safeRoom ? `<Parameter name="roomId" value="${safeRoom}" />` : ``}

      ${safeCallSid ? `<Parameter name="callSid" value="${safeCallSid}" />` : ``}
      ${safeFrom ? `<Parameter name="from" value="${safeFrom}" />` : ``}

      <Parameter name="sessionId" value="${safeSessionId}" />
      ${safeCallerCallSid ? `<Parameter name="callerCallSid" value="${safeCallerCallSid}" />` : ``}

      ${safeTask ? `<Parameter name="task" value="${safeTask}" />` : ``}

      <!-- ✅ M20 location (best-effort) -->
      ${locLat ? `<Parameter name="locLat" value="${escapeForXml(locLat)}" />` : ``}
      ${locLng ? `<Parameter name="locLng" value="${escapeForXml(locLng)}" />` : ``}
      ${locAcc ? `<Parameter name="locAcc" value="${escapeForXml(locAcc)}" />` : ``}
      ${locUpdated ? `<Parameter name="locUpdatedAt" value="${escapeForXml(locUpdated)}" />` : ``}
    </Stream>
  </Connect>

  ${afterStream}
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

function parseModeRole(url: URL): { mode: Mode; role: Role; legacyModeRaw: string } {
  const raw = (url.searchParams.get("mode") || "").trim();

  if (raw === "message") return { mode: "message", role: "caller", legacyModeRaw: raw };

  if (raw === "callee_stream") return { mode: "callee_stream", role: "callee", legacyModeRaw: raw };
  if (raw === "caller_stream") return { mode: "caller_stream", role: "caller", legacyModeRaw: raw };

  if (raw === "callee" || raw === "relay") {
    return { mode: "callee_stream", role: "callee", legacyModeRaw: raw };
  }

  return { mode: "caller_stream", role: "caller", legacyModeRaw: raw || "default" };
}

function parseCalleeType(url: URL): "personal" | "business" {
  const calleeTypeRaw = (url.searchParams.get("calleeType") || "").trim();
  return calleeTypeRaw === "business" ? "business" : "personal";
}

function shaMarker() {
  return process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_GITHUB_COMMIT_SHA || "sha-unknown";
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const { mode, role, legacyModeRaw } = parseModeRole(url);
  const say = (url.searchParams.get("say") || "").trim();
  const roomId = (url.searchParams.get("roomId") || "").trim();

  const task = (url.searchParams.get("task") || "").trim();
  const calleeType = parseCalleeType(url);

  const sessionId = (url.searchParams.get("sessionId") || "").trim();
  const callerCallSid = (url.searchParams.get("callerCallSid") || "").trim();

  if (mode === "message" && say) {
    return twiml(buildMessageTwiml(say, roomId || undefined));
  }

  const wss = (process.env.TWILIO_MEDIA_STREAM_WSS_URL || "").trim();
  const marker = `mode=${mode} legacyMode=${legacyModeRaw} sha=${shaMarker()} wss=${wss ? "SET" : "EMPTY"} method=GET`;

  const location = roomId ? await getLastLocation(roomId).catch(() => null) : null;

  return twiml(
    buildStreamOnlyTwiml({
      marker,
      mode,
      role,
      roomId: roomId || undefined,
      task: role === "callee" ? task : undefined,
      calleeType,
      sessionId: sessionId || undefined,
      callerCallSid: callerCallSid || undefined,
      location: location
        ? { lat: location.lat, lng: location.lng, accuracy: location.accuracy, updatedAt: location.updatedAt }
        : null,
    })
  );
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);

  const { mode, role, legacyModeRaw } = parseModeRole(url);
  const say = (url.searchParams.get("say") || "").trim();
  const roomIdFromQuery = (url.searchParams.get("roomId") || "").trim();

  const task = (url.searchParams.get("task") || "").trim();
  const calleeType = parseCalleeType(url);

  const sessionId = (url.searchParams.get("sessionId") || "").trim();
  const callerCallSid = (url.searchParams.get("callerCallSid") || "").trim();

  if (mode === "message" && say) {
    return twiml(buildMessageTwiml(say, roomIdFromQuery || undefined));
  }

  const wss = (process.env.TWILIO_MEDIA_STREAM_WSS_URL || "").trim();
  const marker = `mode=${mode} legacyMode=${legacyModeRaw} sha=${shaMarker()} wss=${wss ? "SET" : "EMPTY"} method=POST`;

  const form = await req.formData().catch(() => null);
  const callSidRaw = form ? form.get("CallSid") : null;
  const fromRaw = form ? form.get("From") : null;

  const callSid = typeof callSidRaw === "string" ? callSidRaw.trim() : "";
  const from = typeof fromRaw === "string" ? fromRaw.trim() : "";

  const roomId =
    roomIdFromQuery ||
    (callSid ? `call:${callSid}` : from ? `phone:${from}` : "");

  if (role === "caller") {
    await persistActiveCall(roomId, callSid, from);
  }

  const location = roomId ? await getLastLocation(roomId).catch(() => null) : null;

  return twiml(
    buildStreamOnlyTwiml({
      marker,
      mode,
      role,
      roomId: roomId || undefined,
      callSid,
      from,
      task: role === "callee" ? task : undefined,
      calleeType,
      sessionId: sessionId || undefined,
      callerCallSid: callerCallSid || undefined,
      location: location
        ? { lat: location.lat, lng: location.lng, accuracy: location.accuracy, updatedAt: location.updatedAt }
        : null,
    })
  );
}
