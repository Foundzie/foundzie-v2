// src/app/api/voice/session/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  createOrUpdateVoiceSession,
  getVoiceSessionForRoom,
  updateVoiceSessionStatus,
  type VoiceStatus,
} from "../store";

export const dynamic = "force-dynamic";

// POST /api/voice/session
// Body: { roomId: string, userId?: string, status?: VoiceStatus, lastError?: string }
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({} as any))) as any;

  const rawRoomId =
    typeof body.roomId === "string" ? body.roomId.trim() : "";
  const rawUserId =
    typeof body.userId === "string" ? body.userId.trim() : "";
  const rawStatus =
    typeof body.status === "string" ? body.status.trim() : "";
  const lastError =
    typeof body.lastError === "string" ? body.lastError : null;

  if (!rawRoomId) {
    return NextResponse.json(
      { ok: false, message: "roomId is required" },
      { status: 400 }
    );
  }

  try {
    const session = await createOrUpdateVoiceSession({
      roomId: rawRoomId,
      userId: rawUserId || null,
      status: rawStatus || "requested",
      lastError,
    });

    return NextResponse.json({
      ok: true,
      item: session,
    });
  } catch (err: any) {
    console.error("[voice] POST /session error", err);
    return NextResponse.json(
      {
        ok: false,
        message: err?.message || "Failed to create voice session",
      },
      { status: 500 }
    );
  }
}

// PATCH /api/voice/session
// Body: { roomId: string, status: VoiceStatus, lastError?: string }
export async function PATCH(req: NextRequest) {
  const body = (await req.json().catch(() => ({} as any))) as any;

  const rawRoomId =
    typeof body.roomId === "string" ? body.roomId.trim() : "";
  const rawStatus =
    typeof body.status === "string" ? (body.status.trim() as VoiceStatus) : "";
  const lastError =
    typeof body.lastError === "string" ? body.lastError : null;

  if (!rawRoomId || !rawStatus) {
    return NextResponse.json(
      { ok: false, message: "roomId and status are required" },
      { status: 400 }
    );
  }

  try {
    const session = await updateVoiceSessionStatus({
      roomId: rawRoomId,
      status: rawStatus,
      lastError,
    });

    return NextResponse.json({
      ok: true,
      item: session,
    });
  } catch (err: any) {
    console.error("[voice] PATCH /session error", err);
    return NextResponse.json(
      {
        ok: false,
        message: err?.message || "Failed to update voice session",
      },
      { status: 500 }
    );
  }
}

// GET /api/voice/session?roomId=visitor-...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const roomId = (searchParams.get("roomId") || "").trim();

  if (!roomId) {
    return NextResponse.json(
      {
        ok: false,
        message: "roomId query param is required",
      },
      { status: 400 }
    );
  }

  try {
    const session = await getVoiceSessionForRoom(roomId);

    return NextResponse.json({
      ok: true,
      item: session,
    });
  } catch (err: any) {
    console.error("[voice] GET /session error", err);
    return NextResponse.json(
      {
        ok: false,
        message: err?.message || "Failed to load voice session",
      },
      { status: 500 }
    );
  }
}
