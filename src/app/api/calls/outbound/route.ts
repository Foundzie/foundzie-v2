// src/app/api/calls/outbound/route.ts
import { NextResponse } from "next/server";
import { getUser } from "../../users/store";
import { addCallLog } from "../store";
import { startTwilioCall } from "@/lib/twilio";
import { recordOutboundCall } from "../../health/store";

export const dynamic = "force-dynamic";

function normalizeE164(input: string): string {
  const raw = (input || "").trim();

  // Already E.164
  if (raw.startsWith("+")) return raw;

  // Strip non-digits
  const digits = raw.replace(/[^\d]/g, "");

  // US assumptions
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;

  // Fallback: return original raw (will be visible in logs)
  return raw;
}

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

  const message = typeof body.message === "string" ? body.message.trim() : "";

  const roomId =
    typeof body.roomId === "string" && body.roomId.trim()
      ? body.roomId.trim()
      : userId || "";

  // IMPORTANT: Prefer the explicitly provided phone in the request.
  const phoneProvided =
    typeof body.phone === "string" && body.phone.trim() !== "";

  let phoneRaw = phoneProvided ? String(body.phone).trim() : "";
  let user: any = null;

  if (userId) {
    user = await getUser(userId);

    // Only fall back to user's stored phone IF phone was NOT provided.
    if (!phoneProvided && user?.phone && user.phone.trim() !== "") {
      phoneRaw = user.phone.trim();
    }
  }

  const phone = normalizeE164(phoneRaw);

  // 🔥 Diagnostic truth: log exactly what will be dialed
  console.log("[/api/calls/outbound] resolved dialing target:", {
    userId,
    phoneProvided,
    phoneRaw,
    phoneNormalized: phone,
    note,
    mode,
    messagePreview: message ? message.slice(0, 60) : "",
    roomId,
  });

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

  if (!phone.startsWith("+")) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Phone must be E.164 format (+1...). Example: +13312998167",
        debug: { phoneRaw, phoneNormalized: phone },
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

  const twimlUrl =
    mode === "message"
      ? `${base}/api/twilio/message?text=${encodeURIComponent(
          message
        )}&roomId=${encodeURIComponent(roomId || "")}`
      : `${base}/api/twilio/voice${
          roomId ? `?roomId=${encodeURIComponent(roomId)}` : ""
        }`;

  console.log("[/api/calls/outbound] twimlUrl:", twimlUrl);

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
    phone, // store normalized number
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
    debug: {
      phoneProvided,
      phoneRaw,
      phoneNormalized: phone,
      twimlUrl,
    },
  });
}
