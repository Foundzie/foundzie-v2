import "server-only";
import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { kvGetJSON, kvSetJSON } from "@/lib/kv/redis";
import { redirectTwilioCall } from "@/lib/twilio";

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

function normalizeE164(input: string): string {
  const raw = (input || "").trim();
  if (!raw) return "";
  if (raw.startsWith("+")) return raw;

  const digits = raw.replace(/[^\d]/g, "");

  if (digits.startsWith("00") && digits.length >= 11) return `+${digits.slice(2)}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;

  return raw;
}

function activeCallKey(roomId: string) {
  return `foundzie:twilio:active-call:${roomId}:v1`;
}
const LAST_ACTIVE_KEY = "foundzie:twilio:last-active-call:v1";

function cooldownKey(kind: string, fingerprint: string) {
  return `foundzie:tools:cooldown:${kind}:${fingerprint}:v4`;
}

function fingerprintForCall(phone: string, message: string) {
  const p = (phone || "").replace(/[^\d]/g, "").slice(-10);
  const m = (message || "").slice(0, 28);
  return `${p}:${m}`.replace(/[^a-zA-Z0-9:_-]/g, "_");
}

async function resolveActiveCallSid(roomId?: string) {
  const rid = (roomId || "").trim();
  if (rid && rid !== "current") {
    const hit = await kvGetJSON<any>(activeCallKey(rid)).catch(() => null);
    if (hit?.callSid) return { callSid: String(hit.callSid), from: String(hit.from || "") };
  }

  const last = await kvGetJSON<any>(LAST_ACTIVE_KEY).catch(() => null);
  if (last?.callSid) return { callSid: String(last.callSid), from: String(last.from || "") };

  return { callSid: "", from: "" };
}

function relaySessionKey(id: string) {
  return `foundzie:relay:${id}:v1`;
}

function relayByCalleeKey(calleeSid: string) {
  return `foundzie:relay-by-callee:${calleeSid}:v1`;
}

function makeSessionId() {
  return `relay-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * POST /api/tools/call_third_party
 * Body: { phone, message, roomId?, callSid? }
 *
 * ✅ RELAY MODE (NO CONFERENCE):
 * - Redirect caller to hold loop
 * - Dial recipient, deliver message, optionally capture reply
 * - Status callback brings caller back
 *
 * IMPORTANT FIX:
 * - If we FAIL to redirect the caller to hold, we STOP and do NOT dial the callee.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as any;

  const phone = normalizeE164(String(body.phone || ""));
  const message = String(body.message || "").trim().slice(0, 800);

  let roomId = String(body.roomId || "").trim();
  let callSid = String(body.callSid || "").trim();

  if (roomId === "current") roomId = "";
  if (callSid === "current") callSid = "";

  if (!phone || !message) {
    return json({ ok: false, message: "Missing phone or message." }, 400);
  }

  // Resolve active callSid for caller leg
  if (!callSid) {
    const resolved = await resolveActiveCallSid(roomId);
    callSid = resolved.callSid || "";
  }

  if (!callSid) {
    return json(
      {
        ok: false,
        message:
          "Missing active callSid. Ensure /api/twilio/voice stores LAST_ACTIVE_KEY (or pass callSid).",
      },
      400
    );
  }

  // Cooldown (dedupe repeated tool calls)
  const COOLDOWN_SECONDS = Number(process.env.TOOL_CALL_COOLDOWN_SECONDS || 8);
  const fp = fingerprintForCall(phone, message);
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

  await kvSetJSON(cdKey, { at: new Date().toISOString() }).catch(() => null);

  const base = getBaseUrl();
  const sessionId = makeSessionId();

  await kvSetJSON(relaySessionKey(sessionId), {
    sessionId,
    roomId: roomId || null,
    callerCallSid: callSid,
    toPhone: phone,
    message,
    status: "created",
    createdAt: new Date().toISOString(),
  }).catch(() => null);

  // 1) Put caller on hold
  const holdUrl = `${base}/api/twilio/hold?sid=${encodeURIComponent(sessionId)}`;
  const redirectResult = await redirectTwilioCall(callSid, holdUrl).catch((e: any) => {
    return { error: String(e?.message || e) };
  });

  const callerRedirected = !!(redirectResult as any)?.sid;

  // ✅ HARD STOP if we couldn't redirect the caller
  if (!callerRedirected) {
    await kvSetJSON(relaySessionKey(sessionId), {
      sessionId,
      roomId: roomId || null,
      callerCallSid: callSid,
      toPhone: phone,
      message,
      status: "caller_redirect_failed",
      error: (redirectResult as any)?.error || "redirectTwilioCall returned null",
      updatedAt: new Date().toISOString(),
    }).catch(() => null);

    return json(
      {
        ok: false,
        message:
          "Could not put the caller on hold (redirectTwilioCall failed). Not dialing the recipient to avoid desync.",
        phone,
        sessionId,
        steps: { callerRedirected: false, calleeDialed: false },
        urls: { holdUrl },
        twilio: { redirect: redirectResult },
      },
      502
    );
  }

  // 2) Dial recipient and run relay flow
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!sid || !token || !from) {
    return json(
      {
        ok: false,
        message:
          "Twilio env vars missing (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER).",
        steps: { callerRedirected },
        urls: { holdUrl },
      },
      500
    );
  }

  const relayUrl =
    `${base}/api/twilio/relay?sid=${encodeURIComponent(sessionId)}` +
    `&roomId=${encodeURIComponent(roomId || "")}`;

  const client = twilio(sid, token);

  let callee: any = null;
  try {
    callee = await client.calls.create({
      to: phone,
      from,
      url: relayUrl,
      method: "GET",
      statusCallback: `${base}/api/twilio/status`,
      statusCallbackMethod: "POST",
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    });
  } catch (e: any) {
    await kvSetJSON(relaySessionKey(sessionId), {
      sessionId,
      roomId: roomId || null,
      callerCallSid: callSid,
      toPhone: phone,
      message,
      status: "callee_create_failed",
      error: String(e?.message || e),
      updatedAt: new Date().toISOString(),
    }).catch(() => null);

    // Pull caller back immediately
    const failMsg =
      "I tried calling them, but the call didn’t go through. Want me to try again or text them instead?";
    await redirectTwilioCall(
      callSid,
      `${base}/api/twilio/voice?mode=message&say=${encodeURIComponent(failMsg)}${
        roomId ? `&roomId=${encodeURIComponent(roomId)}` : ""
      }`
    ).catch(() => null);

    return json(
      {
        ok: false,
        message: "Failed to create outbound call via Twilio.",
        error: String(e?.message || e),
        phone,
        sessionId,
        steps: { callerRedirected, calleeDialed: false },
        urls: { holdUrl, relayUrl },
        twilio: { redirect: redirectResult },
      },
      502
    );
  }

  // Save calleeSid, and reverse-map calleeSid -> sessionId for status callback recovery
  await kvSetJSON(relaySessionKey(sessionId), {
    sessionId,
    roomId: roomId || null,
    callerCallSid: callSid,
    toPhone: phone,
    message,
    status: "callee_dialed",
    calleeSid: callee?.sid ?? null,
    updatedAt: new Date().toISOString(),
  }).catch(() => null);

  if (callee?.sid) {
    await kvSetJSON(relayByCalleeKey(String(callee.sid)), {
      sessionId,
      createdAt: new Date().toISOString(),
    }).catch(() => null);
  }

  return json({
    ok: true,
    phone,
    roomId: roomId || null,
    callSid,
    sessionId,
    cooldownSeconds: COOLDOWN_SECONDS,
    steps: {
      callerRedirected,
      calleeDialed: !!callee?.sid,
    },
    urls: {
      holdUrl,
      relayUrl,
    },
    twilio: {
      redirect: (redirectResult as any)?.sid ? { sid: (redirectResult as any).sid } : redirectResult,
      calleeSid: callee?.sid ?? null,
      calleeStatus: callee?.status ?? null,
    },
  });
}

export async function GET() {
  return json({ ok: true, message: "call_third_party tool endpoint is live." });
}
