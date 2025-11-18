// src/app/api/calls/outbound/route.ts
import { NextResponse } from "next/server";
import { getUser } from "../../users/store";
import { addCallLog } from "../store";

export const dynamic = "force-dynamic";

// POST /api/calls/outbound
// Body options:
//  - { userId: "29", note?: "Follow-up on booking" }
//  - { phone: "+13315551234", note?: "Manual number" }
// If userId is provided, we try to load the user's phone first.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as unknown));

  const userId =
    typeof (body as any).userId === "string" ? (body as any).userId.trim() : "";
  const note =
    typeof (body as any).note === "string" ? (body as any).note.trim() : "";

  let phone =
    typeof (body as any).phone === "string" ? (body as any).phone.trim() : "";

  let user: Awaited<ReturnType<typeof getUser>> | null = null;

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
          "Missing phone number. Provide phone in body or a userId that has phone set.",
      },
      { status: 400 }
    );
  }

  const callId = `debug-call-${Date.now()}`;

  // Log the request (this is where Twilio will hook in later)
  console.log("[calls] outbound request", {
    userId: user ? user.id : null,
    phone,
    note,
    callId,
  });

  // NEW: store in call logs
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
    // Reminder for future Twilio work
    debug: "Twilio outbound voice integration goes here in the next step.",
  });
}
