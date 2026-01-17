// src/app/api/location/route.ts
import { NextResponse } from "next/server";
import { getLastLocation, setLastLocation } from "./store";

export const dynamic = "force-dynamic";

// GET /api/location?roomId=...
export async function GET(req: Request) {
  const url = new URL(req.url);
  const roomId = (url.searchParams.get("roomId") || "").trim();

  if (!roomId) {
    return NextResponse.json({ ok: false, message: "Missing roomId" }, { status: 400 });
  }

  const item = await getLastLocation(roomId);
  return NextResponse.json({ ok: true, item });
}

// POST /api/location  { roomId, lat, lng, accuracy?, source? }
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({} as any))) as {
    roomId?: string;
    lat?: number;
    lng?: number;
    accuracy?: number;
    source?: string;
  };

  const roomId = String(body.roomId || "").trim();
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const accuracy = body.accuracy == null ? null : Number(body.accuracy);

  if (!roomId) {
    return NextResponse.json({ ok: false, message: "Missing roomId" }, { status: 400 });
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ ok: false, message: "Invalid lat/lng" }, { status: 400 });
  }

  try {
    const item = await setLastLocation({
      roomId,
      lat,
      lng,
      accuracy: Number.isFinite(accuracy as number) ? (accuracy as number) : null,
      source: body.source === "browser" ? "browser" : "browser",
    });
    return NextResponse.json({ ok: true, item });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: typeof e?.message === "string" ? e.message : "Failed to save location" },
      { status: 400 }
    );
  }
}
