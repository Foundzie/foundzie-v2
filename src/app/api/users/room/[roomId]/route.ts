// src/app/api/users/room/[roomId]/route.ts

import { NextResponse } from "next/server";
import {
  ensureUserForRoom,
  updateUser,
} from "../../store";

export const dynamic = "force-dynamic";

type RoomProfileBody = {
  name?: string;
  interest?: string;
  phone?: string;
  source?: string;
  tags?: string[] | string;
};

// Robust roomId resolver: prefer params, fall back to URL last segment
function resolveRoomId(req: Request, params: any): string | null {
  const fromParams = params?.roomId;
  if (typeof fromParams === "string" && fromParams.trim() !== "") {
    return decodeURIComponent(fromParams.trim());
  }

  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  const last = parts[parts.length - 1] ?? "";
  const decoded = decodeURIComponent(last.trim());
  return decoded || null;
}

/* ------------------------------------------------------ */
/* GET /api/users/room/[roomId] – lookup / create by room */
/* ------------------------------------------------------ */
export async function GET(req: Request, context: any) {
  const roomId = resolveRoomId(req, context?.params);
  if (!roomId) {
    return NextResponse.json(
      { ok: false, message: "Missing roomId" },
      { status: 400 }
    );
  }

  // IMPORTANT:
  // Use ensureUserForRoom so this will either:
  //  - find the existing user linked to this roomId, or
  //  - create a minimal one if none exists yet.
  const user = await ensureUserForRoom(roomId, {
    source: "mobile-chat",
  });

  return NextResponse.json({ ok: true, item: user });
}

/* ------------------------------------------------------ */
/* POST /api/users/room/[roomId] – create/update profile  */
/* ------------------------------------------------------ */
export async function POST(req: Request, context: any) {
  const roomId = resolveRoomId(req, context?.params);
  if (!roomId) {
    return NextResponse.json(
      { ok: false, message: "Missing roomId" },
      { status: 400 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as RoomProfileBody;

  const baseName =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim()
      : undefined;
  const interest =
    typeof body.interest === "string" && body.interest.trim()
      ? body.interest.trim()
      : undefined;
  const phone =
    typeof body.phone === "string" && body.phone.trim()
      ? body.phone.trim()
      : undefined;

  // Normalise tags to string[]
  let tags: string[] = [];
  if (Array.isArray(body.tags)) {
    tags = body.tags
      .filter((t) => typeof t === "string" && t.trim() !== "")
      .map((t) => t.trim());
  } else if (typeof body.tags === "string") {
    tags = body.tags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }

  // Ensure a user row exists for this roomId (will also set roomId)
  const existing = await ensureUserForRoom(roomId, {
    name: baseName,
    source: body.source ?? "mobile-chat",
    tags,
  });

  const updated = await updateUser(String(existing.id), {
    ...(baseName ? { name: baseName } : {}),
    ...(interest !== undefined ? { interest } : {}),
    ...(phone !== undefined ? { phone } : {}),
    source: body.source ?? existing.source ?? "mobile-chat",
    tags: tags.length > 0 ? tags : existing.tags,
    roomId, // keep the chat ↔ user link
  });

  return NextResponse.json({ ok: true, item: updated ?? existing });
}
