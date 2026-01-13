// src/app/api/twilio/status/route.ts
import { NextResponse } from "next/server";
import { kvGetJSON, kvSetJSON } from "@/lib/kv/redis";
import { redirectTwilioCall } from "@/lib/twilio";
import { recordTwilioStatusCallback } from "@/app/api/health/store";

export const dynamic = "force-dynamic";

function getBaseUrl(): string {
  const explicit = process.env.TWILIO_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const nextPublic = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (nextPublic) return nextPublic.replace(/\/+$/, "");

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl.replace(/\/+$/, "")}`;

  return "https://foundzie-v2.vercel.app";
}

function relaySessionKey(id: string) {
  return `foundzie:relay:${id}:v1`;
}
function relayByCalleeKey(calleeSid: string) {
  return `foundzie:relay-by-callee:${calleeSid}:v1`;
}

// ---- M16 keys (kept for later; harmless even if M16 postponed) ----
function m16ByCalleeKey(calleeSid: string) {
  return `foundzie:m16:by-callee:${calleeSid}:v1`;
}
function m16CalleeOutcomeKey(sessionId: string) {
  return `foundzie:m16:callee:${sessionId}:v1`;
}

function humanizeOutcome(status: string, errorCode: any) {
  const s = (status || "").toLowerCase();
  if (s === "completed") return "The call completed.";
  if (s === "busy") return "They were busy.";
  if (s === "no-answer") return "They didn’t answer.";
  if (s === "failed")
    return `The call failed${errorCode ? ` (code ${errorCode})` : ""}.`;
  if (s === "canceled") return "The call was canceled.";
  return `The call ended (${status}).`;
}

function summarizeRelaySession(session: any) {
  const s = String(session?.status || "").trim();

  const reply = String(session?.recipientReply || "").trim();
  const confirm = String(session?.recipientConfirm || "").trim();

  if (s === "delivered_with_reply") {
    return reply
      ? `Done — I delivered your message. They replied: ${reply}`
      : `Done — I delivered your message.`;
  }

  if (s === "delivered_no_reply") {
    if (confirm) return `Done — I delivered your message. They said: ${confirm}`;
    return `Done — I delivered your message. They didn’t send a reply.`;
  }

  if (s.startsWith("delivered_")) {
    return `Done — I delivered your message. They didn’t send a reply.`;
  }

  return "";
}

function summarizeM16Outcome(
  outcome: any,
  fallbackStatus: string,
  fallbackError: any
) {
  const reply = String(outcome?.reply || "").trim();
  if (reply)
    return `Done — they replied: ${reply}. Do you want me to do anything else?`;

  const text = String(outcome?.assistantText || "").trim();
  if (text) {
    const snippet = text.replace(/\s+/g, " ").slice(0, 220);
    return `Done — here’s what I got: ${snippet}. Do you want me to do anything else?`;
  }

  return `Done. ${humanizeOutcome(
    fallbackStatus,
    fallbackError
  )} Do you want me to do anything else?`;
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);

  const payload: Record<string, any> = {};
  if (form) {
    for (const [k, v] of form.entries()) payload[k] = v;
  } else {
    const json = await req.json().catch(() => ({}));
    Object.assign(payload, json);
  }

  const callSid = String(payload.CallSid || payload.callsid || "");
  const callStatus = String(payload.CallStatus || payload.callstatus || "");
  const errorCode = payload.ErrorCode ?? payload.errorcode ?? null;

  // ✅ M15: Duration + cost tracking (best-effort)
  const durationSec = payload.CallDuration ? Number(payload.CallDuration) : 0;

  const priceRaw = payload.Price ?? payload.price ?? null;
  const price = priceRaw !== null ? Number(priceRaw) : 0;
  const priceUnit = String(payload.PriceUnit || payload.price_unit || "").toUpperCase(); // usually "USD"

  await recordTwilioStatusCallback({
    status: callStatus,
    durationSec: Number.isFinite(durationSec) ? durationSec : 0,
    priceUsd: priceUnit === "USD" && Number.isFinite(price) ? price : 0,
    errorCode,
  }).catch(() => null);

  console.log("[twilio status]", {
    callSid,
    status: callStatus,
    errorCode,
    durationSec,
    price,
    priceUnit,
    to: String(payload.To || ""),
    from: String(payload.From || ""),
  });

  const terminal = ["completed", "busy", "no-answer", "failed", "canceled"];

  // Ignore non-terminal updates
  if (!callSid || !terminal.includes(callStatus.toLowerCase())) {
    return NextResponse.json({ ok: true });
  }

  // 1) RELAY mapping (M14)
  const reverseRelay = await kvGetJSON<any>(relayByCalleeKey(callSid)).catch(
    () => null
  );
  const relaySessionId = String(reverseRelay?.sessionId || "").trim();

  if (relaySessionId) {
    const session = await kvGetJSON<any>(relaySessionKey(relaySessionId)).catch(
      () => null
    );
    const callerCallSid = String(session?.callerCallSid || "").trim();
    const roomId = String(session?.roomId || "").trim();

    const alreadyFinal =
      String(session?.status || "").includes("final_") ||
      String(session?.status || "").includes("delivered_");

    if (!alreadyFinal) {
      const relaySummary = summarizeRelaySession(session);
      const fallbackOutcome = humanizeOutcome(callStatus, errorCode);
      const say =
        relaySummary ||
        `Done. ${fallbackOutcome} Do you want me to do anything else?`;

      await kvSetJSON(relaySessionKey(relaySessionId), {
        ...session,
        status: `final_${callStatus.toLowerCase()}`,
        calleeFinalStatus: callStatus,
        calleeErrorCode: errorCode,
        updatedAt: new Date().toISOString(),
      }).catch(() => null);

      if (callerCallSid) {
        const base = getBaseUrl();
        await redirectTwilioCall(
          callerCallSid,
          `${base}/api/twilio/voice?mode=message&say=${encodeURIComponent(say)}${
            roomId ? `&roomId=${encodeURIComponent(roomId)}` : ""
          }`
        ).catch((e) =>
          console.warn("[twilio status] redirect caller failed", e)
        );
      }
    }

    return NextResponse.json({ ok: true });
  }

  // 2) M16 mapping (kept for later)
  const reverseM16 = await kvGetJSON<any>(m16ByCalleeKey(callSid)).catch(
    () => null
  );
  const m16SessionId = String(reverseM16?.sessionId || "").trim();
  if (!m16SessionId) {
    return NextResponse.json({ ok: true });
  }

  const outcome = await kvGetJSON<any>(m16CalleeOutcomeKey(m16SessionId)).catch(
    () => null
  );
  const callerCallSid = String(outcome?.callerCallSid || "").trim();
  const roomId = String(outcome?.roomId || "").trim();

  const say = summarizeM16Outcome(outcome, callStatus, errorCode);

  if (callerCallSid) {
    const base = getBaseUrl();
    await redirectTwilioCall(
      callerCallSid,
      `${base}/api/twilio/voice?mode=message&say=${encodeURIComponent(say)}${
        roomId ? `&roomId=${encodeURIComponent(roomId)}` : ""
      }`
    ).catch((e) =>
      console.warn("[twilio status] redirect caller failed (m16)", e)
    );
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
