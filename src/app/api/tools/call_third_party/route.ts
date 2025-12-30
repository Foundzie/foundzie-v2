import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { kvGetJSON, kvSetJSON } from "@/lib/kv/redis";
import { redirectTwilioCall, startTwilioCall } from "@/lib/twilio";

export const dynamic = "force-dynamic";

function json(body: any, status = 200) {
  return NextResponse.json(body, { status });
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

/**
 * Accepts:
 * - 3312998167
 * - +13312998167
 * - 0013312998167
 * - 13312998167
 * - (331) 299-8167
 */
function normalizeE164(input: string): string {
  const raw = (input || "").trim();
  if (!raw) return "";

  if (raw.startsWith("+")) return raw;

  const digits = raw.replace(/[^\d]/g, "");

  // 00 + countrycode...
  if (digits.startsWith("00") && digits.length >= 11) {
    return `+${digits.slice(2)}`;
  }

  // 11 digits starting with 1 (US)
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;

  // 10 digits -> assume US
  if (digits.length === 10) return `+1${digits}`;

  // typed countrycode without +
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;

  return raw;
}

function safeConfName(input: string) {
  const s = (input || "foundzie-default").trim();
  return s.replace(/[^a-zA-Z0-9:_-]/g, "-").slice(0, 80);
}

function activeCallKey(roomId: string) {
  return `foundzie:twilio:active-call:${roomId}:v1`;
}
const LAST_ACTIVE_KEY = "foundzie:twilio:last-active-call:v1";

/** Tool cooldown keys */
function cooldownKey(kind: string, fingerprint: string) {
  return `foundzie:tools:cooldown:${kind}:${fingerprint}:v1`;
}

function fingerprintForCall(phone: string, message: string, callSid: string) {
  const p = (phone || "").slice(-8);
  const m = (message || "").slice(0, 24);
  const c = (callSid || "").slice(-10);
  return `${p}:${c}:${m}`.replace(/[^a-zA-Z0-9:_-]/g, "_");
}

async function resolveActiveCallSid(roomId?: string) {
  if (roomId) {
    const hit = await kvGetJSON<any>(activeCallKey(roomId)).catch(() => null);
    if (hit?.callSid) {
      return { callSid: String(hit.callSid), from: String(hit.from || "") };
    }
  }
  const last = await kvGetJSON<any>(LAST_ACTIVE_KEY).catch(() => null);
  if (last?.callSid) {
    return { callSid: String(last.callSid), from: String(last.from || "") };
  }
  return { callSid: "", from: "" };
}

/**
 * POST /api/tools/call_third_party
 * Body: { phone, message, roomId?, callSid? }
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as any;

  const phone = normalizeE164(String(body.phone || ""));
  const message = String(body.message || "").trim().slice(0, 800);

  const roomId = String(body.roomId || "").trim();
  let callSid = String(body.callSid || "").trim();

  if (!phone || !message) {
    return json({ ok: false, message: "Missing phone or message." }, 400);
  }

  // If bridge passed "current" or nothing, resolve from KV
  if (!callSid || callSid === "current") {
    const resolved = await resolveActiveCallSid(roomId || "");
    callSid = resolved.callSid || "";
  }

  if (!callSid) {
    return json(
      {
        ok: false,
        message:
          "Missing active callSid. Ensure /api/twilio/voice persists KV mapping, or pass callSid from bridge customParameters.",
      },
      400
    );
  }

  // ✅ SMART COOLDOWN (NO TTL): store { at } and check elapsed time
  const COOLDOWN_SECONDS = Number(process.env.TOOL_CALL_COOLDOWN_SECONDS || 12);
  const fp = fingerprintForCall(phone, message, callSid);
  const cdKey = cooldownKey("call_third_party", fp);

  const existing = await kvGetJSON<any>(cdKey).catch(() => null);
  const lastAt = existing?.at ? Date.parse(String(existing.at)) : 0;
  const now = Date.now();

  if (lastAt && !Number.isNaN(lastAt)) {
    const elapsedMs = now - lastAt;
    if (elapsedMs >= 0 && elapsedMs < COOLDOWN_SECONDS * 1000) {
      const remaining = Math.ceil((COOLDOWN_SECONDS * 1000 - elapsedMs) / 1000);
      return json(
        {
          ok: false,
          message: "Blocked by cooldown (duplicate call request too soon).",
          cooldownSeconds: COOLDOWN_SECONDS,
          remainingSeconds: remaining,
          fingerprint: fp,
        },
        429
      );
    }
  }

  // set cooldown (2 args only — fixes your error)
  await kvSetJSON(cdKey, { at: new Date().toISOString() }).catch(() => null);

  const conf = safeConfName(roomId ? `foundzie-${roomId}` : `foundzie-${callSid}`);
  const base = getBaseUrl();

  // 1) Redirect YOU (active caller) into conference
  const joinUrl = `${base}/api/twilio/conference/join?conf=${encodeURIComponent(conf)}`;
  const redirectResult = await redirectTwilioCall(callSid, joinUrl);
  const callerRedirected = !!redirectResult?.sid;

  // 2) Dial third party into same conference (bridge TwiML handles greet+pause+message)
  const bridgeUrl =
    `${base}/api/twilio/conference/bridge` +
    `?conf=${encodeURIComponent(conf)}` +
    `&text=${encodeURIComponent(message)}`;

  const calleeCall = await startTwilioCall(phone, {
    voiceUrl: bridgeUrl,
    note: "tool:call_third_party",
  });

  return json({
    ok: true,
    phone,
    roomId: roomId || null,
    callSid,
    conf,
    base,
    cooldownSeconds: COOLDOWN_SECONDS,
    steps: {
      callerRedirected,
      calleeDialed: !!calleeCall?.sid,
    },
    urls: {
      joinUrl,
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
