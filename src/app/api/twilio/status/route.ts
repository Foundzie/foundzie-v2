// src/app/api/twilio/status/route.ts
import { NextResponse } from "next/server";
import { kvGetJSON, kvSetJSON } from "@/lib/kv/redis";
import { redirectTwilioCall } from "@/lib/twilio";

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

function humanizeOutcome(status: string, errorCode: any) {
  const s = (status || "").toLowerCase();
  if (s === "completed") return "I delivered your message.";
  if (s === "busy") return "They were busy.";
  if (s === "no-answer") return "They didn’t answer.";
  if (s === "failed") return `The call failed${errorCode ? ` (code ${errorCode})` : ""}.`;
  if (s === "canceled") return "The call was canceled.";
  return `The call ended (${status}).`;
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
  const to = String(payload.To || "");
  const from = String(payload.From || "");

  console.log("[twilio status]", {
    callSid,
    status: callStatus,
    errorCode,
    to,
    from,
  });

  // ✅ If this CallSid is the outbound callee leg, bring caller back off hold.
  // We only act on terminal-ish states.
  const terminal = ["completed", "busy", "no-answer", "failed", "canceled"];
  if (callSid && terminal.includes(callStatus.toLowerCase())) {
    const reverse = await kvGetJSON<any>(relayByCalleeKey(callSid)).catch(() => null);
    const sessionId = String(reverse?.sessionId || "").trim();

    if (sessionId) {
      const session = await kvGetJSON<any>(relaySessionKey(sessionId)).catch(() => null);
      const callerCallSid = String(session?.callerCallSid || "").trim();
      const roomId = String(session?.roomId || "").trim();

      // Avoid double-finalizing
      const alreadyFinal =
        String(session?.status || "").includes("final_") ||
        String(session?.status || "").includes("delivered_");

      if (!alreadyFinal) {
        const outcome = humanizeOutcome(callStatus, errorCode);

        await kvSetJSON(relaySessionKey(sessionId), {
          ...session,
          status: `final_${callStatus.toLowerCase()}`,
          calleeFinalStatus: callStatus,
          calleeErrorCode: errorCode,
          updatedAt: new Date().toISOString(),
        }).catch(() => null);

        if (callerCallSid) {
          const base = getBaseUrl();
          const say = `Done. ${outcome} Do you want me to do anything else?`;

          await redirectTwilioCall(
            callerCallSid,
            `${base}/api/twilio/voice?mode=message&say=${encodeURIComponent(say)}${
              roomId ? `&roomId=${encodeURIComponent(roomId)}` : ""
            }`
          ).catch((e) => console.warn("[twilio status] redirect caller failed", e));
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
