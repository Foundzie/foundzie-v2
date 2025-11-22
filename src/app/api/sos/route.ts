// src/app/api/sos/route.ts
import { NextResponse } from "next/server";
import { addEvent, listEvents, updateEvent } from "./store";

export const dynamic = "force-dynamic";

/**
 * GET /api/sos
 * Used by the Admin SOS page to fetch the list.
 * Response: { ok: true, items: SosEvent[] }
 */
export async function GET() {
  try {
    const items = await listEvents();
    return NextResponse.json({ ok: true, items });
  } catch (err) {
    console.error("[/api/sos] GET error:", err);
    return NextResponse.json(
      { ok: false, message: "Failed to load SOS events" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sos
 * Used by the mobile SOS screen to create a new event.
 * Body: { message, type?, location?, source?, phone?, userId? }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const message = typeof body.message === "string" ? body.message.trim() : "";
    const type = typeof body.type === "string" ? body.type : "general";
    const location =
      typeof body.location === "string" ? body.location : undefined;
    const source =
      typeof body.source === "string" ? body.source : "mobile-sos";
    const phone = typeof body.phone === "string" ? body.phone : undefined;
    const userId = typeof body.userId === "string" ? body.userId : undefined;

    if (!message) {
      return NextResponse.json(
        { ok: false, message: "Missing SOS message" },
        { status: 400 }
      );
    }

    const event = await addEvent({
      message,
      type,
      location,
      source,
      phone,
      userId,
    });

    return NextResponse.json({ ok: true, item: event });
  } catch (err) {
    console.error("[/api/sos] POST error:", err);
    return NextResponse.json(
      { ok: false, message: "Failed to create SOS event" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/sos
 * Used by the Admin SOS page to update status / add notes.
 * Body: { id, status?, note?, by?, userId? }
 */
export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const id = typeof body.id === "string" ? body.id.trim() : "";
    const status = body.status as any;
    const note = typeof body.note === "string" ? body.note : undefined;
    const by = typeof body.by === "string" ? body.by : undefined;
    const userId =
      body.userId === undefined
        ? undefined
        : body.userId === null
        ? null
        : String(body.userId);

    if (!id) {
      return NextResponse.json(
        { ok: false, message: "Missing SOS id" },
        { status: 400 }
      );
    }

    const updated = await updateEvent(id, {
      status,
      newActionText: note,
      newActionBy: by,
      userId,
    });

    if (!updated) {
      return NextResponse.json(
        { ok: false, message: "SOS event not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, item: updated });
  } catch (err) {
    console.error("[/api/sos] PATCH error:", err);
    return NextResponse.json(
      { ok: false, message: "Failed to update SOS event" },
      { status: 500 }
    );
  }
}
