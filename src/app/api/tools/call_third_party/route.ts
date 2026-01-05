// src/app/api/tools/call_third_party/route.ts
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
    try {
      const hit = await kvGetJSON<any>(activeCallKey(rid));
      if (hit?.callSid) return { callSid: String(hit.callSid), from: String(hit.from || "") };
    } catch (e) {
      console.error("[call_third_party] kv read failed (activeCallKey)", { roomId: rid, error: String(e) });
    }
  }

  try {
    const last = await kvGetJSON<any>(LAST_ACTIVE_KEY);
    if (last?.callSid) return { callSid: String(last.callSid), from: String(last.from || "") };
  } catch (e) {
    console.error("[call_third_party] kv read failed (LAST_ACTIVE_KEY)", { error: String(e) });
  }

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

async function kvSetOrThrow(key: string, value: any, label: string) {
  try {
    await kvSetJSON(key, value);
  } catch (e) {
    console.error(`[call_third_party] KV WRITE FAILED (${label})`, { key, error: String(e) });
    throw e;
  }
}

async function kvGetOrNull(key: string, label: string) {
  try {
    return await kvGetJSON<any>(key);
  } catch (e) {
    console.error(`[call_third_party] KV READ FAILED (${label})`, { key, error: String(e) });
    return null;
  }
}

/**
 * POST /api/tools/call_third_party
 * Body: { phone, message, roomId?, callSid?, calleeType? }
 *
 * ✅ RELAY MODE (NO CONFERENCE)
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as any;

  const phone = normalizeE164(String(body.phone || ""));
  const message = String(body.message || "").trim().slice(0, 800);

  let roomId = String(body.roomId || "").trim();
  let callSid = String(body.callSid || "").trim();

  const calleeTypeRaw = String(body.calleeType || "").trim();
  const calleeType: "personal" | "business" = calleeTypeRaw === "business" ? "business" : "personal";

  if (roomId === "current") roomId = "";
  if (callSid === "current") callSid = "";

  if (!phone || !message) {
    return json({ ok: false, message: "Missing phone or message." }, 400);
  }

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

  // Cooldown
  const COOLDOWN_SECONDS = Number(process.env.TOOL_CALL_COOLDOWN_SECONDS || 8);
  const fp = fingerprintForCall(phone, message);
  const cdKey = cooldownKey("call_third_party", fp);

  const existing = await kvGetOrNull(cdKey, "cooldown_read");
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

  // IMPORTANT: do not swallow KV errors anymore
  try {
    await kvSetOrThrow(cdKey, { at: new Date().toISOString() }, "cooldown_write");
  } catch {
    return json({ ok: false, error: "kv_write_failed", where: "cooldown" }, 500);
  }

  const base = getBaseUrl();
  const sessionId = makeSessionId();

  // 0) Save relay session FIRST (hard requirement)
  const sessionPayload = {
    sessionId,
    roomId: roomId || null,
    callerCallSid: callSid,
    toPhone: phone,
    message,
    calleeType,
    status: "created",
    createdAt: new Date().toISOString(),
  };

  try {
    await kvSetOrThrow(relaySessionKey(sessionId), sessionPayload, "relay_session_create");
  } catch {
    return json(
      {
        ok: false,
        error: "kv_write_failed",
        where: "relay_session_create",
        sessionId,
      },
      500
    );
  }

  console.log("[call_third_party] relay session saved", {
    sessionId,
    callSid,
    roomId: roomId || null,
    calleeType,
    toPhone: phone,
    msgLen: message.length,
  });

  // 1) Put caller on hold
  const holdUrl = `${base}/api/twilio/hold?sid=${encodeURIComponent(sessionId)}`;

  let redirectResult: any = null;
  try {
    redirectResult = await redirectTwilioCall(callSid, holdUrl);
  } catch (e: any) {
    redirectResult = { error: String(e?.message || e) };
  }

  const callerRedirected = !!redirectResult?.sid;
  if (!callerRedirected) {
    // update session with hard KV (best effort, but do log if fails)
    try {
      await kvSetOrThrow(
        relaySessionKey(sessionId),
        {
          ...sessionPayload,
          status: "caller_redirect_failed",
          error: redirectResult?.error || "redirectTwilioCall returned null",
          updatedAt: new Date().toISOString(),
        },
        "relay_session_update_redirect_failed"
      );
    } catch {
      // already logged by kvSetOrThrow
    }

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

  // 2) Dial recipient
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!sid || !token || !from) {
    // bring caller back (best effort)
    const failMsg =
      "Twilio is not fully configured on the server, so I cannot place the outbound call right now.";
    await redirectTwilioCall(
      callSid,
      `${base}/api/twilio/voice?mode=message&say=${encodeURIComponent(failMsg)}${
        roomId ? `&roomId=${encodeURIComponent(roomId)}` : ""
      }`
    ).catch(() => null);

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
    `&calleeType=${encodeURIComponent(calleeType)}`;

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
    console.error("[call_third_party] twilio outbound create FAILED", { sessionId, error: String(e?.message || e) });

    try {
      await kvSetOrThrow(
        relaySessionKey(sessionId),
        {
          ...sessionPayload,
          status: "callee_create_failed",
          error: String(e?.message || e),
          updatedAt: new Date().toISOString(),
        },
        "relay_session_update_callee_create_failed"
      );
    } catch {
      // logged
    }

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

  // Save dialed state (hard log on failure)
  const calleeSid = callee?.sid ? String(callee.sid) : null;

  try {
    await kvSetOrThrow(
      relaySessionKey(sessionId),
      {
        ...sessionPayload,
        status: "callee_dialed",
        calleeSid,
        updatedAt: new Date().toISOString(),
      },
      "relay_session_update_callee_dialed"
    );
  } catch {
    // logged
  }

  if (calleeSid) {
    try {
      await kvSetOrThrow(
        relayByCalleeKey(calleeSid),
        { sessionId, createdAt: new Date().toISOString() },
        "relay_by_callee_write"
      );
    } catch {
      // logged
    }
  }

  return json({
    ok: true,
    phone,
    roomId: roomId || null,
    callSid,
    calleeType,
    sessionId,
    cooldownSeconds: COOLDOWN_SECONDS,
    steps: {
      callerRedirected,
      calleeDialed: !!calleeSid,
    },
    urls: {
      holdUrl,
      relayUrl,
    },
    twilio: {
      redirect: redirectResult?.sid ? { sid: redirectResult.sid } : redirectResult,
      calleeSid,
      calleeStatus: callee?.status ?? null,
    },
  });
}

export async function GET() {
  return json({ ok: true, message: "call_third_party tool endpoint is live." });
}
