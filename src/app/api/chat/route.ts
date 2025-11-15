// src/app/api/chat/route.ts
import { NextResponse } from "next/server";
import { listMessages, addMessage } from "./store";
import type { ChatMessage } from "./store";

export const dynamic = "force-dynamic";

// GET /api/chat -> list all messages
export async function GET() {
  const items = await listMessages();
  return NextResponse.json({ items });
}

// POST /api/chat -> add a new message (usually from user)
// Optionally auto-add a concierge reply.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));

  const rawText = typeof body.text === "string" ? body.text.trim() : "";
  const rawSender = typeof body.sender === "string" ? body.sender : "user";

  if (!rawText) {
    return NextResponse.json(
      { ok: false, message: "Missing text" },
      { status: 400 },
    );
  }

  const sender = rawSender === "concierge" ? "concierge" : "user";

  // Save the incoming message
  const userMessage = await addMessage({ sender, text: rawText });

  let reply: ChatMessage | null = null;

  // Simple automatic concierge reply for now
  if (sender === "user") {
    const replyText = `Got it: "${rawText}". A concierge (or Foundzie) will follow up shortly.`;
    reply = await addMessage({
      sender: "concierge",
      text: replyText,
    });
  }

  return NextResponse.json({
    ok: true,
    item: userMessage,
    reply,
  });
}
