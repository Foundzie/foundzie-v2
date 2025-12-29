// src/app/api/calls/outbound/route.ts
import { NextResponse } from "next/server";
import { getUser } from "../../users/store";
import { addCallLog } from "../store";
import { startTwilioCall } from "@/lib/twilio";
import { recordOutboundCall } from "../../health/store";

export const dynamic = "force-dynamic";

/**
 * POST /api/calls/outbound
 *
 * Existing fields:
 *  - userId (string)
 *  - phone (string) optional if userId has phone
 *  - note (string)
 *
 * New fields (non-breaking):
 *  - mode: "voice" | "message" (default "voice")
 *  - message: string (used when mode="message")
 *  - roomId: string (optional trace id; if omitted we use userId)
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";

  const modeRaw = typeof body.mode === "string" ? body.mode.trim() : "";
  const mode: "voice" | "message" = modeRaw === "message" ? "message" : "voice";

  const message =
    typeof body.message === "string" ? body.message.trim() : "";

  const roomId =
    typeof body.roomId === "string" && body.roomId.trim()
      ? body.roomId.trim()
      : userId || "";

  let phone = typeof body.phone === "string" ? body.phone.trim() : "";
  let user = null;

  if (userId) {
    user = await getUser(userId);
    if (user?.phone && user.phone.trim() !== "") {
      phone = user.phone.trim();
    }
  }

  if (!phone) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Missing phone number. Provide phone in body or a userId with phone set.",
      },
      { status: 400 }
    );
  }

  if (mode === "message" && !message) {
    return NextResponse.json(
      {
        ok: false,
        message: "Missing message. Provide { mode:'message', message:'...' }",
      },
      { status: 400 }
    );
  }

  const callId = `call-${Date.now()}`;

  // 1) Choose TwiML URL
  const origin =
    process.env.TWILIO_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "https://foundzie-v2.vercel.app";

  const base = origin.replace(/\/+$/, "");

  // Voice (existing) -> /api/twilio/voice
  // Message (new) -> /api/twilio/message?text=...&roomId=...
  const twimlUrl =
    mode === "message"
      ? `${base}/api/twilio/message?text=${encodeURIComponent(
          message
        )}&roomId=${encodeURIComponent(roomId || "")}`
      : `${base}/api/twilio/voice${
          roomId ? `?roomId=${encodeURIComponent(roomId)}` : ""
        }`;

  // 2) Attempt Twilio call (auto-skips if env vars missing)
  let twilioResult: any = null;
  let twilioErrored = false;

  try {
    twilioResult = await startTwilioCall(phone, {
  note,
  voiceUrl: twimlUrl,
});

  } catch (err) {
    twilioErrored = true;
    console.error("[/api/calls/outbound] Twilio error:", err);
  }

  const twilioStatus: "started" | "skipped" | null = twilioResult
    ? "started"
    : "skipped";

  await recordOutboundCall({
    hadError: twilioErrored,
    twilioStatus,
  });

  // 3) Always log internally (preserves your Admin Calls page)
  const log = await addCallLog({
    id: callId,
    userId: user ? String(user.id) : userId ? String(userId) : null,
    userName: user ? user.name : null,
    phone,
    note: mode === "message" ? `MSG: ${message}` : note,
    direction: "outbound",
  });

  return NextResponse.json({
    ok: true,
    callId: log.id,
    phone: log.phone,
    userId: log.userId,
    userName: log.userName,
    note: log.note,
    createdAt: log.createdAt,
    twilioSid: twilioResult?.sid ?? null,
    twilioStatus,
    mode,
  });
}
