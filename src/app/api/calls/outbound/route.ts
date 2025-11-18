// src/app/api/calls/outbound/route.ts
import { NextResponse } from "next/server";
import { getUser } from "../../users/store";

export const dynamic = "force-dynamic";

// POST /api/calls/outbound
// Body options:
//  - { userId: "29", note?: "Follow-up on booking" }
//  - { phone: "+13315551234", note?: "Manual number" }
// If userId is provided, we try to load the user's phone first.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));

  const userId =
    typeof body.userId === "string" ? body.userId.trim() : "";
  const note =
    typeof body.note === "string" ? body.note.trim() : "";

  let phone =
    typeof body.phone === "string" ? body.phone.trim() : "";

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
          "Missing phone number. Provide phone in body or a userId that has phone set.",
      },
      { status: 400 }
    );
  }

  const callId = `debug-call-${Date.now()}`;

  // For now we just log and return a fake call id.
  // 🔧 When you're ready for real Twilio:
  //  - add twilio client here
  //  - use environment variables for credentials and from-number
  console.log("[calls] outbound request", {
    userId: user ? user.id : null,
    phone,
    note,
    callId,
  });

  return NextResponse.json({
    ok: true,
    callId,
    phone,
    userId: user ? user.id : null,
    note,
    // This line reminds us where Twilio will plug in next milestone
    debug: "Twilio outbound voice integration goes here in the next step.",
  });
}
