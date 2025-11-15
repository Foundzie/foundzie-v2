// src/app/api/chat/route.ts

import { NextResponse } from "next/server";
import { listRooms } from "./store";

export const dynamic = "force-dynamic";

// GET /api/chat -> list of chat rooms (summaries)
export async function GET() {
  const rooms = await listRooms();
  return NextResponse.json({ rooms });
}
