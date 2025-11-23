// src/app/api/notifications/route.ts
import { NextResponse } from "next/server";
import {
  listNotifications,
  upsertNotificationFromPayload,
} from "@/app/api/notifications/store";

// GET all notifications (admin + mobile both use this)
export async function GET() {
  const items = await listNotifications();
  return NextResponse.json(items);
}

// POST will either create OR update (if id is present)
export async function POST(req: Request) {
  const data = await req.json();

  const result = await upsertNotificationFromPayload(data);

  return NextResponse.json({
    ok: true,
    created: result.created,
    updated: result.updated,
    item: result.item,
  });
}
