import { NextRequest, NextResponse } from "next/server";
import { addMessage } from "@/app/api/chat/store";

export const dynamic = "force-dynamic";

// POST /api/conversation/turn
// Body: { roomId: string, sender: "user" | "concierge", text: string, meta?: any }
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({} as any))) as any;

  const roomId = typeof body.roomId === "string" ? body.roomId.trim() : "";
  const senderRaw = typeof body.sender === "string" ? body.sender : "user";
  const text = typeof body.text === "string" ? body.text.trim() : "";

  if (!roomId || !text) {
    return NextResponse.json(
      { ok: false, message: "roomId + text are required" },
      { status: 400 }
    );
  }

  const sender: "user" | "concierge" = senderRaw === "concierge" ? "concierge" : "user";

  const item = await addMessage(roomId, {
    sender,
    text,
    attachmentName: null,
    attachmentKind: null,
  });

  return NextResponse.json({ ok: true, item });
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "conversation turn endpoint live" });
}
