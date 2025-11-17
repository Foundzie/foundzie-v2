// src/app/api/sos/route.ts

import { NextResponse } from "next/server";
import {
  addEvent,
  listEvents,
  updateEvent,
  type SosStatus,
} from "./store";
import { addMessage } from "../chat/store";

export const dynamic = "force-dynamic";

// GET /api/sos -> list all SOS events (optionally filtered by userId)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const userIdParam = url.searchParams.get("userId");
  const userId = userIdParam ? userIdParam.trim() : "";

  const items = await listEvents();
  const filtered = userId
    ? items.filter((e) => (e.userId ?? "") === userId)
    : items;

  return NextResponse.json({ items: filtered });
}

// POST /api/sos -> create a new SOS event from mobile
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as any;

  const rawMessage =
    typeof body.message === "string" ? body.message.trim() : "";
  const type =
    typeof body.type === "string" ? body.type.trim() : "general";
  const location =
    typeof body.location === "string" ? body.location.trim() : "";
  const phone =
    typeof body.phone === "string" ? body.phone.trim() : "";
  const source =
    typeof body.source === "string" ? body.source.trim() : "mobile-sos";

  const userId =
    typeof body.userId === "string" && body.userId.trim()
      ? body.userId.trim()
      : "";

  if (!rawMessage) {
    return NextResponse.json(
      { ok: false, message: "Missing SOS message" },
      { status: 400 }
    );
  }

  // 1) store the SOS event
  const sos = await addEvent({
    message: rawMessage,
    type,
    location,
    phone,
    source,
    ...(userId ? { userId } : {}),
  });

  // 2) also drop a system-style message into the chat history
  // For now we use a single default room id
  const chatText = `⚠️ SOS sent: "${rawMessage}". A concierge is being notified and will assist you.`;

  await addMessage("default", {
    sender: "concierge",
    text: chatText,
    attachmentName: null,
    attachmentKind: null,
  });

  return NextResponse.json({ ok: true, item: sos });
}

// PATCH /api/sos -> update status of an SOS event (+ optional note + optional user link)
export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => ({}))) as any;

  const id = typeof body.id === "string" ? body.id : "";
  const status = body.status as SosStatus | undefined;

  const note =
    typeof body.note === "string" ? body.note.trim() : "";
  const by =
    typeof body.by === "string" && body.by.trim()
      ? body.by.trim()
      : "Admin";

  const userId =
    typeof body.userId === "string" && body.userId.trim()
      ? body.userId.trim()
      : undefined;

  if (!id) {
    return NextResponse.json(
      { ok: false, message: "Missing SOS id" },
      { status: 400 }
    );
  }

  if (!status || !["new", "in-progress", "resolved"].includes(status)) {
    return NextResponse.json(
      { ok: false, message: "Invalid status" },
      { status: 400 }
    );
  }

  const patch: {
    status: SosStatus;
    newActionText?: string;
    newActionBy?: string;
    userId?: string | null;
  } = { status };

  if (note) {
    patch.newActionText = note;
    patch.newActionBy = by;
  }

  if (userId !== undefined) {
    patch.userId = userId;
  }

  const updated = await updateEvent(id, patch);

  if (!updated) {
    return NextResponse.json(
      { ok: false, message: "SOS event not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, item: updated });
}
