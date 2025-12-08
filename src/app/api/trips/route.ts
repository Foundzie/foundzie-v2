import { NextResponse } from "next/server";
import { addTrip, listTrips } from "./store";

export const dynamic = "force-dynamic";

/**
 * GET /api/trips
 * For admin later: list all saved trip plans.
 * Response: { ok: true, items: TripPlan[] }
 */
export async function GET() {
  try {
    const items = await listTrips();
    return NextResponse.json({ ok: true, items });
  } catch (err) {
    console.error("[/api/trips] GET error:", err);
    return NextResponse.json(
      { ok: false, message: "Failed to load trip plans" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/trips
 * Used by the mobile chat "Save plan" button.
 * Body: { roomId, messageId, text, createdAt?, userId? }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const roomId =
      typeof body.roomId === "string" ? body.roomId.trim() : "";
    const messageId =
      typeof body.messageId === "string" ? body.messageId.trim() : "";
    const text =
      typeof body.text === "string" ? body.text.trim() : "";
    const createdAt =
      typeof body.createdAt === "string" ? body.createdAt : undefined;
    const userId =
      body.userId === undefined
        ? undefined
        : body.userId === null
        ? null
        : String(body.userId);

    if (!roomId || !messageId || !text) {
      return NextResponse.json(
        { ok: false, message: "Missing roomId, messageId, or text" },
        { status: 400 }
      );
    }

    const trip = await addTrip({
      roomId,
      messageId,
      text,
      createdAt,
      userId,
    });

    return NextResponse.json({ ok: true, item: trip });
  } catch (err) {
    console.error("[/api/trips] POST error:", err);
    return NextResponse.json(
      { ok: false, message: "Failed to save trip plan" },
      { status: 500 }
    );
  }
}
