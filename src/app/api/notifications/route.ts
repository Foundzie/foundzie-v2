import { NextResponse } from "next/server";
import {
  listNotifications,
  upsertNotificationFromPayload,
} from "@/app/api/notifications/store";

export const dynamic = "force-dynamic";

// GET /api/notifications?roomId=...
export async function GET(req: Request) {
  const url = new URL(req.url);
  const roomId = (url.searchParams.get("roomId") || "").trim();

  const items = await listNotifications({ roomId: roomId || undefined });
  return NextResponse.json(items);
}

// POST will either create OR update (if id is present)
export async function POST(req: Request) {
  const data = await req.json().catch(() => ({} as any));

  const result = await upsertNotificationFromPayload(data);

  return NextResponse.json({
    ok: true,
    created: result.created,
    updated: result.updated,
    item: result.item,
  });
}
