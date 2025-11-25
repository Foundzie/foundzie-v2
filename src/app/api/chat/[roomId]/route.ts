// src/app/api/chat/[roomId]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { listMessages, addMessage } from "../store";
import type { ChatMessage } from "@/app/data/chat";
import { runFoundzieAgent } from "@/lib/agent/runtime";

import { listUsers, createUser, updateUser } from "../../users/store";
import type { AdminUser } from "@/app/data/users";

export const dynamic = "force-dynamic";

// We keep the context as `any` to avoid strict Next.js generic type issues.
// We'll still safely pull `roomId` from context.params.
type RoomParams = { roomId: string };

// --------- Emergency / confirmation helpers (Option C) ----------

function isEmergencyText(text: string): boolean {
  const t = text.toLowerCase();

  const triggers = [
    "emergency",
    "sos",
    "i am in danger",
    "i'm in danger",
    "im in danger",
    "real danger",
    "im in real danger",
    "someone is trying to break in",
    "trying to break in",
    "breaking in",
    "they are outside my house",
    "they're outside my house",
    "they are trying to kill me",
    "they're trying to kill me",
    "want to hurt myself",
    "want to kill myself",
    "want to die",
    "don't want to live",
    "dont want to live",
    "being abused",
    "i'm being abused",
    "domestic violence",
    "call the police",
    "call 911",
    "need help right now",
    "help me right now",
  ];

  return triggers.some((phrase) => t.includes(phrase));
}

function isConfirmationText(text: string): boolean {
  const t = text.trim().toLowerCase();

  const exactYes = ["yes", "yeah", "yep", "ya", "ok", "okay", "please"];
  if (exactYes.includes(t)) return true;

  const softConfirms = [
    "please help",
    "please do it",
    "go ahead",
    "do it",
    "alert them",
    "open an sos",
    "open a case",
    "contact them",
    "call them",
    "i need help now",
    "help me now",
    "yes please",
    "yes i need help",
  ];

  return softConfirms.some((phrase) => t.includes(phrase));
}

/* ------------------------------------------------------------------ */
/*  Auto-create / link visitor profile for this room                  */
/* ------------------------------------------------------------------ */

async function ensureVisitorUserForRoom(roomId: string): Promise<AdminUser | null> {
  if (!roomId) return null;

  try {
    const all = await listUsers();
    const existing = all.find(
      (u) => String(u.roomId).trim() === String(roomId).trim()
    );
    if (existing) {
      return existing;
    }

    // No user yet for this roomId → create a minimal "collected" profile
    const now = new Date();
    const joined = now.toISOString().slice(0, 10); // e.g. "2025-11-23"

    const base = await createUser({
      name: "Anonymous visitor",
      email: `anonymous+${roomId}@visitor.local`,
      phone: null,
      role: "viewer",
      status: "collected",
      joined,
      interest: "",
      source: "mobile-chat",
      tags: [],
    });

    // Make sure the profile is linked to this specific chat room
    const updated = await updateUser(String(base.id), { roomId });
    return updated ?? base;
  } catch (err) {
    console.error("[chat] ensureVisitorUserForRoom failed:", err);
    return null;
  }
}

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

  // Only trigger the agent (and auto-profile logic) when a *user* sends something.
  if (sender === "user") {
    // 🔹 Ensure we have a visitor profile for this room
    await ensureVisitorUserForRoom(roomId);

    const agentInputBase =
      rawText ||
      (attachmentName ? `User sent attachment: ${attachmentName}` : "");

    // --------------- Option C: Hybrid SOS logic -----------------
    const lowerText = (rawText || "").toLowerCase();
    const emergencyNow = isEmergencyText(lowerText);
    const confirmationNow = isConfirmationText(lowerText);

    // Look at recent user messages to see if there was an earlier emergency
    const history = await listMessages(roomId);
    const recentUserMessages = history
      .filter((m) => m.sender === "user")
      .slice(-5); // last 5 user messages

    const emergencyEarlier = recentUserMessages.some((m) =>
      isEmergencyText((m.text || "").toLowerCase())
    );

    // Confirmed emergency if:
    // - current message is both emergency + confirmation, OR
    // - earlier message was emergency and current message is confirmation.
    const confirmedEmergency =
      (emergencyNow && confirmationNow) ||
      (confirmationNow && emergencyEarlier);

    // toolsMode: "debug" ONLY when emergency is confirmed, otherwise off.
    const toolsMode: "off" | "debug" = confirmedEmergency ? "debug" : "off";

    // Decorate the input a bit if we know it's confirmed emergency
    const agentInput = confirmedEmergency
      ? `[CONFIRMED_EMERGENCY]\nThe user is in immediate danger and has explicitly asked for help / for you to alert their emergency contacts or open an SOS case.\n\nUser message: ${agentInputBase}`
      : agentInputBase;

    try {
      const agentResult = await runFoundzieAgent({
        input: agentInput,
        roomId,
        // If you later pass real user IDs from the client, they will show up here.
        userId: typeof body.userId === "string" ? body.userId : undefined,
        source: "mobile",
        toolsMode,
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
