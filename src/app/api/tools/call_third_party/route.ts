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

function sanitizeMessage(s: unknown, max = 800): string {
  const t = typeof s === "string" ? s.trim() : "";
  return t.slice(0, max);
}

function normalizeMessages(body: any): string[] {
  const out: string[] = [];

  if (Array.isArray(body?.messages)) {
    for (const m of body.messages) {
      const t = sanitizeMessage(m, 800);
      if (t) out.push(t);
    }
  }

  const legacy = sanitizeMessage(body?.message, 800);
  if (legacy) out.push(legacy);

  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const m of out) {
    if (seen.has(m)) continue;
    seen.add(m);
    uniq.push(m);
  }

  return uniq;
}

function joinForTask(messages: string[]): string {
  return messages
    .map((m) => m.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ");
}

function activeCallKey(roomId: string) {
  return `foundzie:twilio:active-call:${roomId}:v1`;
}
const LAST_ACTIVE_KEY = "foundzie:twilio:last-active-call:v1";

function cooldownKey(kind: string, fingerprint: string) {
  return `foundzie:tools:cooldown:${kind}:${fingerprint}:v4`;
}

function fingerprintForCall(phone: string, messages: string[]) {
  const p = (phone || "").replace(/[^\d]/g, "").slice(-10);
  const joined = (messages || []).join(" ").slice(0, 64);
  return `${p}:${joined}`.replace(/[^a-zA-Z0-9:_-]/g, "_");
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

// Existing M14 relay keys
function relaySessionKey(id: string) {
  return `foundzie:relay:${id}:v1`;
}
function relayByCalleeKey(calleeSid: string) {
  return `foundzie:relay-by-callee:${calleeSid}:v1`;
}

// M16 keys
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

  if (explicit === "callee_stream" || explicit === "m16") return "callee_stream";
  if (explicit === "relay" || explicit === "m14") return "relay";

  const envDefault = String(process.env.M16_DEFAULT_CALL_MODE || "").trim().toLowerCase();
  if (envDefault === "callee_stream") return "callee_stream";
  if (envDefault === "relay") return "relay";

  if (stream) return "callee_stream";

  return "relay";
}

/**
 * VERBATIM SAFETY:
 * - LLM callee_stream can paraphrase long messages.
 * - For personal calls OR long messages, force M14 relay (Twilio <Say>) to guarantee verbatim delivery + reply capture.
 */
function shouldForceRelay(calleeType: "personal" | "business", messages: string[], joined: string) {
  const forceEnv = String(process.env.FORCE_RELAY_FOR_PERSONAL || "1").trim() !== "0";
  const longThreshold = Number(process.env.RELAY_LONG_MESSAGE_THRESHOLD || 80); // chars
  const isLong = (joined || "").length >= longThreshold || messages.length > 1;

  if (calleeType === "personal" && forceEnv) return true; // safest default
  if (calleeType === "personal" && isLong) return true;
  if (String(process.env.FORCE_RELAY_FOR_LONG_MESSAGES || "1").trim() !== "0" && isLong) return true;

  return false;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as any;

  const phone = normalizeE164(String(body.phone || ""));
  const messages = normalizeMessages(body);
  const messageJoined = joinForTask(messages);

  let roomId = String(body.roomId || "").trim();
  let callSid = String(body.callSid || "").trim();

  const calleeTypeRaw = String(body.calleeType || "").trim();
  const calleeType: "personal" | "business" =
    calleeTypeRaw === "business" ? "business" : "personal";

  const confirm = body.confirm === true;

  if (roomId === "current") roomId = "";
  if (callSid === "current") callSid = "";

  if (!phone || messages.length === 0) {
    return json({ ok: false, message: "Missing phone or message(s)." }, 400);
  }

  // Confirmation gate remains unchanged
  const strictConfirmEnabled = String(process.env.STRICT_MESSAGE_CONFIRM || "1").trim() !== "0";
  const multi = messages.length > 1;
  if (strictConfirmEnabled && (calleeType === "personal" || multi)) {
    if (!confirm) {
      return json(
        {
          ok: false,
          blocked: "confirmation_required",
          message: "Confirmation required before placing a personal or multi-message call.",
          calleeType,
          messages,
          instruction: "Repeat the exact message(s) verbatim, ask for YES, then retry with confirm=true.",
        },
        409
      );
    }
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
  const fp = fingerprintForCall(phone, messages);
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

  // Decide mode, then apply verbatim safety override
  let chosenMode = decideCallMode(body);
  if (shouldForceRelay(calleeType, messages, messageJoined)) {
    chosenMode = "relay";
  }

  const sessionId = chosenMode === "relay" ? makeSessionId("relay") : makeSessionId("m16");
  const createdAt = new Date().toISOString();

  const sharedSession = {
    sessionId,
    mode: chosenMode,
    roomId: roomId || null,
    callerCallSid: callSid,
    toPhone: phone,
    messages,
    message: messageJoined,
    calleeType,
    status: "created",
    createdAt,
    confirm: confirm ? true : false,
  };

  try {
    await kvSetOrThrow(relaySessionKey(sessionId), sharedSession, "relay_session_create");
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
    messagesCount: messages.length,
    msgLen: messageJoined.length,
  });

  // Hold caller
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
        { ...sharedSession, status: "caller_redirect_failed", error: redirectResult?.error || "redirectTwilioCall returned null", updatedAt },
        "relay_session_update_redirect_failed"
      );
      await kvSetOrThrow(
        m16SessionKey(sessionId),
        { ...sharedSession, status: "caller_redirect_failed", error: redirectResult?.error || "redirectTwilioCall returned null", updatedAt },
        "m16_session_update_redirect_failed"
      );
    } catch {}
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

  // Dial recipient
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

  const relayUrl =
    `${base}/api/twilio/relay?sid=${encodeURIComponent(sessionId)}` +
    `&calleeType=${encodeURIComponent(calleeType)}`;

  const task = messageJoined.slice(0, 900); // VERBATIM payload only
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
      statusCallbackEvent: [
        "initiated",
        "ringing",
        "answered",
        "completed",
        "busy",
        "no-answer",
        "failed",
        "canceled",
      ],
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
    } catch {}

    const failMsg =
      "I tried calling them, but the call didn’t go through. Want me to try again?";
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
  } catch {}

  if (calleeSid) {
    if (chosenMode === "relay") {
      try {
        await kvSetOrThrow(relayByCalleeKey(calleeSid), { sessionId, createdAt: new Date().toISOString() }, "relay_by_callee_write");
      } catch {}
    } else {
      try {
        await kvSetOrThrow(m16ByCalleeKey(calleeSid), { sessionId, createdAt: new Date().toISOString() }, "m16_by_callee_write");
      } catch {}
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
    messages,
    cooldownSeconds: COOLDOWN_SECONDS,
    steps: { callerRedirected, calleeDialed: !!calleeSid },
    urls: { holdUrl, outboundUrl, relayUrl, calleeStreamUrl },
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
