// src/app/api/chat/route.ts

import { NextResponse } from "next/server";
import { listRooms, type ChatRoomSummary } from "./store";

// Fallback: build chat rooms list from /api/users store
import { listUsers } from "../users/store";

export const dynamic = "force-dynamic";

// GET /api/chat -> list of chat rooms (summaries)
export async function GET() {
  let rooms: ChatRoomSummary[] = [];

  // 1) Primary source: KV-backed chat rooms
  try {
    const base = await listRooms();
    if (Array.isArray(base)) {
      rooms = base;
    }
  } catch (err) {
    console.error("[chat] listRooms failed, will fall back to users:", err);
  }

  // 2) Fallback: derive rooms from users' roomId if KV index is empty or broken
  if (!Array.isArray(rooms) || rooms.length === 0) {
    try {
      const users = await listUsers();
      const seen = new Set<string>();

      rooms = users
        .map((u) => (u.roomId ? String(u.roomId).trim() : ""))
        .filter((rid) => rid.length > 0)
        .filter((rid) => {
          if (seen.has(rid)) return false;
          seen.add(rid);
          return true;
        })
        .map((rid) => ({
          id: rid,
          lastMessage: undefined,
          lastAt: undefined,
          lastSender: undefined,
        }));
    } catch (err) {
      console.error("[chat] fallback rooms-from-users failed:", err);
      rooms = [];
    }
  }

  return NextResponse.json({ rooms });
}
