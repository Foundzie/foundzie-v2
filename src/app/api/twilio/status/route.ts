// src/app/api/twilio/status/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);

  // Twilio sends application/x-www-form-urlencoded by default
  const payload: Record<string, any> = {};
  if (form) {
    for (const [k, v] of form.entries()) payload[k] = v;
  } else {
    // fallback: if someone changes Twilio to JSON later
    const json = await req.json().catch(() => ({}));
    Object.assign(payload, json);
  }

  const callSid = String(payload.CallSid || payload.callsid || "");
  const status = String(payload.CallStatus || payload.callstatus || "");
  const errorCode = payload.ErrorCode ?? payload.errorcode ?? null;
  const to = String(payload.To || "");
  const from = String(payload.From || "");

  console.log("[twilio status]", {
    callSid,
    status,
    errorCode,
    to,
    from,
    payload, // keep for now while debugging
  });

  // Important: respond fast
  return NextResponse.json({ ok: true });
}

export async function GET() {
  // helpful for quick test in browser
  return NextResponse.json({ ok: true });
}
