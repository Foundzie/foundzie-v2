// src/app/api/voice/session/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST /api/voice/session
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));
  const roomId =
    typeof body.roomId === "string" && body.roomId.trim().length > 0
      ? body.roomId.trim()
      : null;

  return NextResponse.json({
    ok: true,
    roomId,
    message: "Voice session stub – realtime audio to be added later.",
  });
}

// Simple sanity GET
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Foundzie voice endpoint stub is live.",
  });
}
