// src/app/api/calls/outbound/route.ts
import { NextResponse } from "next/server";
import { getUser } from "../../users/store";
import { addCallLog } from "../store";
import { startTwilioCall } from "@/lib/twilio";
import { recordOutboundCall } from "../../health/store";

export const dynamic = "force-dynamic";

// POST /api/calls/outbound
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));

  const userId =
    typeof body.userId === "string" ? body.userId.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";

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

  const callId = `call-${Date.now()}`;

  // 1) Attempt Twilio call (auto-skips if env vars missing)
  let twilioResult: any = null;
  let twilioErrored = false;

  try {
    twilioResult = await startTwilioCall(phone, note);
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

  // 2) Always log internally (preserves your Admin Calls page)
  const log = await addCallLog({
    id: callId,
    userId: user ? String(user.id) : null,
    userName: user ? user.name : null,
    phone,
    note,
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
  });
}
