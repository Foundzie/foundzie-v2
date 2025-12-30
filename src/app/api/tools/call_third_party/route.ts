import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { kvGetJSON } from "@/lib/kv/redis";
import { redirectTwilioCall, startTwilioCall } from "@/lib/twilio";

export const dynamic = "force-dynamic";

function json(body: any, status = 200) {
  return NextResponse.json(body, { status });
}

function normalizeE164(input: string): string {
  const raw = (input || "").trim();
  if (!raw) return "";
  if (raw.startsWith("+")) return raw;
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return raw; // leave as-is so you can see what was passed
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

function safeConfName(input: string) {
  // Twilio conf names: keep simple/clean
  const s = (input || "foundzie-default").trim();
  return s.replace(/[^a-zA-Z0-9:_-]/g, "-").slice(0, 80);
}

function activeCallKey(roomId: string) {
  return `foundzie:twilio:active-call:${roomId}:v1`;
}
const LAST_ACTIVE_KEY = "foundzie:twilio:last-active-call:v1";

async function resolveActiveCallSid(roomId?: string) {
  if (roomId) {
    const hit = await kvGetJSON<any>(activeCallKey(roomId)).catch(() => null);
    if (hit?.callSid) return { callSid: String(hit.callSid), from: String(hit.from || "") };
  }
  const last = await kvGetJSON<any>(LAST_ACTIVE_KEY).catch(() => null);
  if (last?.callSid) return { callSid: String(last.callSid), from: String(last.from || "") };
  return { callSid: "", from: "" };
}

/**
 * POST /api/tools/call_third_party
 * Body: { phone, message, roomId?, callSid? }
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as any;

  const phone = normalizeE164(String(body.phone || ""));
  const message = String(body.message || "").trim();

  const roomId = String(body.roomId || "").trim();
  let callSid = String(body.callSid || "").trim();

  if (!phone || !message) {
    return json({ ok: false, message: "Missing phone or message." }, 400);
  }

  // If bridge didn't pass callSid, try KV mapping
  if (!callSid) {
    const resolved = await resolveActiveCallSid(roomId || "");
    callSid = resolved.callSid || "";
  }

  // Conference name ties the caller + callee together
  const conf = safeConfName(roomId ? `foundzie-${roomId}` : callSid ? `foundzie-${callSid}` : "foundzie-default");

  const base = getBaseUrl();

  // 1) Redirect the ACTIVE caller into conference (if we have callSid)
  let callerRedirected = false;
  let redirectResult: any = null;

  if (callSid) {
    const joinUrl = `${base}/api/twilio/conference/join?conf=${encodeURIComponent(conf)}`;
    redirectResult = await redirectTwilioCall(callSid, joinUrl);
    callerRedirected = !!redirectResult?.sid;
  }

  // 2) Dial the third party into same conference + say message
  const bridgeUrl =
    `${base}/api/twilio/conference/bridge` +
    `?conf=${encodeURIComponent(conf)}` +
    `&text=${encodeURIComponent(message)}`;

  const calleeCall = await startTwilioCall(phone, { voiceUrl: bridgeUrl, note: "tool:call_third_party" });

  return json({
    ok: true,
    phone,
    roomId: roomId || null,
    callSid: callSid || null,
    conf,
    base,
    steps: {
      callerRedirected,
      calleeDialed: !!calleeCall?.sid,
    },
    urls: {
      joinUrl: callSid ? `${base}/api/twilio/conference/join?conf=${encodeURIComponent(conf)}` : null,
      bridgeUrl,
    },
    twilio: {
      redirectSid: redirectResult?.sid ?? null,
      calleeSid: calleeCall?.sid ?? null,
    },
  });
}

export async function GET() {
  return json({ ok: true, message: "call_third_party tool endpoint is live." });
}
