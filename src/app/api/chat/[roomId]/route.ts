// src/app/api/chat/[roomId]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { listMessages, addMessage } from "../store";
import type { ChatMessage } from "@/app/data/chat";
import { runFoundzieAgent } from "@/lib/agent/runtime";

export const dynamic = "force-dynamic";

// We keep the context as `any` to avoid strict Next.js generic type issues.
// We'll still safely pull `roomId` from context.params.
type RoomParams = { roomId: string };

// GET /api/chat/[roomId] -> messages for a single room
export async function GET(_req: NextRequest, context: any) {
  const { roomId } = (context.params as RoomParams) ?? { roomId: "default" };

  const items = await listMessages(roomId);
  return NextResponse.json({ items });
}

// POST /api/chat/[roomId] -> send a new message to that room
export async function POST(req: NextRequest, context: any) {
  const { roomId } = (context.params as RoomParams) ?? { roomId: "default" };

  const body = (await req.json().catch(() => ({}))) as any;

  const rawText =
    typeof body.text === "string" ? body.text.trim() : "";
  const rawSender =
    typeof body.sender === "string" ? body.sender : "user";
  const attachmentName =
    typeof body.attachmentName === "string"
      ? body.attachmentName.trim()
      : null;

  const attachmentKind: "image" | "file" | null =
    body.attachmentKind === "image" || body.attachmentKind === "file"
      ? body.attachmentKind
      : null;

  // Must have at least some text OR an attachment
  if (!rawText && !attachmentName) {
    return NextResponse.json(
      { ok: false, message: "Missing text or attachment" },
      { status: 400 }
    );
  }

  const sender = rawSender === "concierge" ? "concierge" : "user";

  // Save the incoming message (metadata only for attachments)
  const userMessage = await addMessage(roomId, {
    sender,
    text: rawText,
    attachmentName: attachmentName ?? null,
    attachmentKind,
  });

  let reply: ChatMessage | null = null;

  // Only trigger the agent when a *user* sends something.
  if (sender === "user") {
    const agentInput =
      rawText ||
      (attachmentName ? `User sent attachment: ${attachmentName}` : "");

    try {
      const agentResult = await runFoundzieAgent({
        input: agentInput,
        roomId,
        // If you later pass real user IDs from the client, they will show up here.
        userId: typeof body.userId === "string" ? body.userId : undefined,
        source: "mobile",
      });

      const replyText =
        agentResult.replyText ||
        `Got it: ${rawText || attachmentName}. A concierge (or Foundzie) will follow up shortly.`;

      reply = await addMessage(roomId, {
        sender: "concierge",
        text: replyText,
        attachmentName: null,
        attachmentKind: null,
      });
    } catch (err) {
      console.error("[chat] Agent stub failed:", err);

      // Safe fallback: behave like the old hard-coded reply
      const fallbackText = `Got it: ${
        rawText || attachmentName
      }. A concierge (or Foundzie) will follow up shortly.`;

      reply = await addMessage(roomId, {
        sender: "concierge",
        text: fallbackText,
        attachmentName: null,
        attachmentKind: null,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    item: userMessage,
    reply,
  });
}
