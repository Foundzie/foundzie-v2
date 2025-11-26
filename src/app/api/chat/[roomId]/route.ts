// src/app/api/chat/[roomId]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { listMessages, addMessage } from "../store";
import type { ChatMessage } from "@/app/data/chat";
import { runFoundzieAgent } from "@/lib/agent/runtime";

// use the shared helper so chat + users stay in sync
import { ensureUserForRoom } from "../../users/store";

export const dynamic = "force-dynamic";

type RoomParams = { roomId?: string };

/**
 * Normalise the roomId coming from the route params.
 * Falls back to the demo room only if nothing was provided.
 */
function normalizeRoomId(params?: RoomParams): string {
  const raw = params?.roomId ?? "";
  if (!raw) return "demo-visitor-1"; // fallback for legacy/demo

  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/* ------------------------------------------------------------------ */
/*  GET /api/chat/[roomId] -> messages for a single room               */
/* ------------------------------------------------------------------ */

export async function GET(_req: NextRequest, context: any) {
  const roomId = normalizeRoomId(context?.params as RoomParams);

  const items = await listMessages(roomId);
  return NextResponse.json({ items });
}

/* ------------------------------------------------------------------ */
/*  POST /api/chat/[roomId] -> send a new message to that room         */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest, context: any) {
  const roomId = normalizeRoomId(context?.params as RoomParams);

  try {
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

    const sender: "user" | "concierge" =
      rawSender === "concierge" ? "concierge" : "user";

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
      // Ensure we have a visitor profile for this room
      await ensureUserForRoom(roomId, {
        source: "mobile-chat",
        tags: ["concierge-request"],
      });

      const agentInputBase =
        rawText ||
        (attachmentName ? `User sent attachment: ${attachmentName}` : "");

      try {
        const agentResult = await runFoundzieAgent({
          input: agentInputBase,
          roomId,
          // if caller doesn't send userId, fall back to roomId
          userId:
            typeof body.userId === "string" ? body.userId : roomId,
          source: "mobile",
          // keep toolsMode simple & safe here
          toolsMode: "off",
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
        console.error("[chat] Agent call failed, using fallback:", err);

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
  } catch (err) {
    console.error("[chat] POST /api/chat/[roomId] fatal error:", err);
    return NextResponse.json(
      { ok: false, message: "Chat server error" },
      { status: 500 }
    );
  }
}
