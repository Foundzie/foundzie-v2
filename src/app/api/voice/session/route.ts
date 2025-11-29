// src/app/api/voice/session/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  getVoiceSessionForRoom,
  upsertVoiceSession,
  type VoiceStatus,
} from "../store";

export const dynamic = "force-dynamic";

// GET /api/voice/session?roomId=...
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const roomId = url.searchParams.get("roomId");

  if (!roomId || roomId.trim().length === 0) {
    return NextResponse.json({
      ok: true,
      status: "none" as VoiceStatus,
      session: null,
    });
  }

  const cleanRoomId = roomId.trim();
  const session = await getVoiceSessionForRoom(cleanRoomId);

  return NextResponse.json({
    ok: true,
    status: (session?.status ?? "none") as VoiceStatus,
    session,
  });
}

// POST /api/voice/session
// Body: { roomId: string, userId?: string, status?: VoiceStatus }
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({} as any))) as {
    roomId?: string;
    userId?: string | null;
    status?: VoiceStatus;
  };

  const roomId =
    typeof body.roomId === "string" && body.roomId.trim().length > 0
      ? body.roomId.trim()
      : null;

  if (!roomId) {
    return NextResponse.json(
      {
        ok: false,
        message: "roomId is required for a voice session.",
      },
      { status: 400 }
    );
  }

  const userId =
    typeof body.userId === "string" && body.userId.trim().length > 0
      ? body.userId.trim()
      : null;

  const status: VoiceStatus =
    typeof body.status === "string"
      ? (body.status as VoiceStatus)
      : "requested";

  const session = await upsertVoiceSession({
    roomId,
    userId,
    status,
  });

  return NextResponse.json({
    ok: true,
    status: session.status,
    session,
  });
}
