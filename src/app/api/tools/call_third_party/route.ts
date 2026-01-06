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
      console.error("[call_third_party] kv read failed (activeCallKey)", {
        roomId: rid,
        error: String(e),
      });
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

// Existing M14 relay keys (keep for backward compatibility)
function relaySessionKey(id: string) {
  return `foundzie:relay:${id}:v1`;
}
function relayByCalleeKey(calleeSid: string) {
  return `foundzie:relay-by-callee:${calleeSid}:v1`;
}

// New M16 callee-stream state keys (bridge/status will write into these)
function m16SessionKey(sessionId: string) {
  return `foundzie:m16:session:${sessionId}:v1`;
}
function m16CalleeStateKey(sessionId: string) {
  return `foundzie:m16:callee:${sessionId}:v1`;
}
function m16ByCalleeKey(calleeSid: string) {
  return `foundzie:m16:by-callee:${calleeSid}:v1`;
}

function makeSessionId(prefix = "session") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

function decideCallMode(body: any): "relay" | "callee_stream" {
  const explicit = String(body?.mode || "").trim().toLowerCase();
  const stream = body?.stream === true;

  // explicit requests
  if (explicit === "callee_stream" || explicit === "m16") return "callee_stream";
  if (explicit === "relay" || explicit === "m14") return "relay";

  // env default (lets you flip without changing the tool prompt)
  const envDefault = String(process.env.M16_DEFAULT_CALL_MODE || "").trim().toLowerCase();
  if (envDefault === "callee_stream") return "callee_stream";
  if (envDefault === "relay") return "relay";

  // boolean
  if (stream) return "callee_stream";

  // default safe behavior: keep M14 stable unless explicitly enabled
  return "relay";
}

/**
 * POST /api/tools/call_third_party
 * Body: {
 *   phone,
 *   message,
 *   roomId?,
 *   callSid?,
 *   calleeType?,
 *   mode? ("relay" | "callee_stream" | "m14" | "m16"),
 *   stream? boolean,
 * }
 *
 * ✅ NO CONFERENCE invariant (always): caller is held, callee is separate leg.
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

  // Cooldown (prevents duplicate tool calls)
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

  try {
    await kvSetOrThrow(cdKey, { at: new Date().toISOString() }, "cooldown_write");
  } catch {
    return json({ ok: false, error: "kv_write_failed", where: "cooldown" }, 500);
  }

  const base = getBaseUrl();
  const chosenMode = decideCallMode(body);

  // Shared sessionId for either mode
  const sessionId = chosenMode === "relay" ? makeSessionId("relay") : makeSessionId("m16");

  // --- 0) Persist session state FIRST (hard requirement) ---
  const createdAt = new Date().toISOString();

  const sharedSession = {
    sessionId,
    mode: chosenMode,
    roomId: roomId || null,
    callerCallSid: callSid,
    toPhone: phone,
    message,
    calleeType,
    status: "created",
    createdAt,
  };

  try {
    // Backward compatible (M14 relay expects foundzie:relay:<id>:v1)
    await kvSetOrThrow(relaySessionKey(sessionId), sharedSession, "relay_session_create");

    // M16 state containers (bridge/status will update these later)
    await kvSetOrThrow(m16SessionKey(sessionId), sharedSession, "m16_session_create");
    await kvSetOrThrow(
      m16CalleeStateKey(sessionId),
      {
        sessionId,
        mode: chosenMode,
        calleeSid: null,
        transcript: [],
        outcome: null,
        status: "created",
        createdAt,
        updatedAt: createdAt,
      },
      "m16_callee_state_create"
    );
  } catch {
    return json({ ok: false, error: "kv_write_failed", where: "session_create", sessionId }, 500);
  }

  console.log("[call_third_party] session saved", {
    sessionId,
    mode: chosenMode,
    callSid,
    roomId: roomId || null,
    calleeType,
    toPhone: phone,
    msgLen: message.length,
  });

  // --- 1) Put caller on hold ---
  const holdUrl = `${base}/api/twilio/hold?sid=${encodeURIComponent(sessionId)}`;

  let redirectResult: any = null;
  try {
    redirectResult = await redirectTwilioCall(callSid, holdUrl);
  } catch (e: any) {
    redirectResult = { error: String(e?.message || e) };
  }

  const callerRedirected = !!redirectResult?.sid;
  if (!callerRedirected) {
    const updatedAt = new Date().toISOString();
    try {
      await kvSetOrThrow(
        relaySessionKey(sessionId),
        {
          ...sharedSession,
          status: "caller_redirect_failed",
          error: redirectResult?.error || "redirectTwilioCall returned null",
          updatedAt,
        },
        "relay_session_update_redirect_failed"
      );
      await kvSetOrThrow(
        m16SessionKey(sessionId),
        {
          ...sharedSession,
          status: "caller_redirect_failed",
          error: redirectResult?.error || "redirectTwilioCall returned null",
          updatedAt,
        },
        "m16_session_update_redirect_failed"
      );
    } catch {
      // logged
    }

    return json(
      {
        ok: false,
        message:
          "Could not put the caller on hold (redirectTwilioCall failed). Not dialing the recipient to avoid desync.",
        phone,
        sessionId,
        mode: chosenMode,
        steps: { callerRedirected: false, calleeDialed: false },
        urls: { holdUrl },
        twilio: { redirect: redirectResult },
      },
      502
    );
  }

  // --- 2) Dial recipient (either relay TTS or callee_stream realtime) ---
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!sid || !token || !from) {
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

  const client = twilio(sid, token);

  // M14 relay URL (existing)
  const relayUrl =
    `${base}/api/twilio/relay?sid=${encodeURIComponent(sessionId)}` +
    `&calleeType=${encodeURIComponent(calleeType)}`;

  // M16 callee_stream URL (new)
  const task = `Deliver this message once, then ask for a short reply. Message: ${message}`.slice(
    0,
    900
  );
  const calleeStreamUrl =
    `${base}/api/twilio/voice?mode=callee_stream` +
    `&calleeType=${encodeURIComponent(calleeType)}` +
    `&sessionId=${encodeURIComponent(sessionId)}` +
    `&callerCallSid=${encodeURIComponent(callSid)}` +
    (roomId ? `&roomId=${encodeURIComponent(roomId)}` : "") +
    `&task=${encodeURIComponent(task)}`;

  const outboundUrl = chosenMode === "callee_stream" ? calleeStreamUrl : relayUrl;

  let callee: any = null;
  try {
    callee = await client.calls.create({
      to: phone,
      from,
      url: outboundUrl,
      method: "GET",
      statusCallback: `${base}/api/twilio/status`,
      statusCallbackMethod: "POST",
      // IMPORTANT: include failure states so caller can be resumed if callee fails
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed", "busy", "no-answer", "failed", "canceled"],
    });
  } catch (e: any) {
    console.error("[call_third_party] twilio outbound create FAILED", {
      sessionId,
      mode: chosenMode,
      error: String(e?.message || e),
    });

    const updatedAt = new Date().toISOString();
    try {
      await kvSetOrThrow(
        relaySessionKey(sessionId),
        { ...sharedSession, status: "callee_create_failed", error: String(e?.message || e), updatedAt },
        "relay_session_update_callee_create_failed"
      );
      await kvSetOrThrow(
        m16SessionKey(sessionId),
        { ...sharedSession, status: "callee_create_failed", error: String(e?.message || e), updatedAt },
        "m16_session_update_callee_create_failed"
      );
      await kvSetOrThrow(
        m16CalleeStateKey(sessionId),
        {
          sessionId,
          mode: chosenMode,
          calleeSid: null,
          transcript: [],
          outcome: { ok: false, reason: "callee_create_failed", error: String(e?.message || e) },
          status: "callee_create_failed",
          createdAt,
          updatedAt,
        },
        "m16_callee_state_update_create_failed"
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
        mode: chosenMode,
        steps: { callerRedirected, calleeDialed: false },
        urls: { holdUrl, outboundUrl, relayUrl, calleeStreamUrl },
        twilio: { redirect: redirectResult },
      },
      502
    );
  }

  const calleeSid = callee?.sid ? String(callee.sid) : null;
  const updatedAt = new Date().toISOString();

  // Persist dialed state (both legacy + M16 keys)
  try {
    await kvSetOrThrow(
      relaySessionKey(sessionId),
      { ...sharedSession, status: "callee_dialed", calleeSid, outboundUrl, updatedAt },
      "relay_session_update_callee_dialed"
    );
    await kvSetOrThrow(
      m16SessionKey(sessionId),
      { ...sharedSession, status: "callee_dialed", calleeSid, outboundUrl, updatedAt },
      "m16_session_update_callee_dialed"
    );
    await kvSetOrThrow(
      m16CalleeStateKey(sessionId),
      {
        sessionId,
        mode: chosenMode,
        calleeSid,
        transcript: [],
        outcome: null,
        status: chosenMode === "callee_stream" ? "callee_stream_started" : "relay_started",
        createdAt,
        updatedAt,
      },
      "m16_callee_state_update_started"
    );
  } catch {
    // logged
  }

  // ✅ IMPORTANT: map calleeSid -> sessionId ONLY for the mode that needs it
  if (calleeSid) {
    if (chosenMode === "relay") {
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

    if (chosenMode === "callee_stream") {
      try {
        await kvSetOrThrow(
          m16ByCalleeKey(calleeSid),
          { sessionId, createdAt: new Date().toISOString() },
          "m16_by_callee_write"
        );
      } catch {
        // logged
      }
    }
  }

  return json({
    ok: true,
    mode: chosenMode,
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
      outboundUrl,
      relayUrl,
      calleeStreamUrl,
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
