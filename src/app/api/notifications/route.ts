// src/app/api/notifications/route.ts
import { NextResponse } from "next/server";
import { mockNotifications } from "@/app/data/notifications";

// GET all notifications (admin + mobile both use this)
export async function GET() {
  return NextResponse.json(mockNotifications);
}

// POST will either create OR update (if id is present)
export async function POST(req: Request) {
  const data = await req.json();
  const now = "just now";

  // if body has an id -> try to update
  if (data.id) {
    const idx = mockNotifications.findIndex((n) => n.id === data.id);
    if (idx !== -1) {
      mockNotifications[idx] = {
        ...mockNotifications[idx],
        title: data.title ?? mockNotifications[idx].title,
        message: data.message ?? mockNotifications[idx].message,
        type: data.type ?? mockNotifications[idx].type,
        actionLabel: data.actionLabel ?? mockNotifications[idx].actionLabel,
        actionHref: data.actionHref ?? mockNotifications[idx].actionHref,
        time: now,
      };
      return NextResponse.json({ ok: true, updated: true });
    }
  }

  // otherwise create a new one
  const newItem = {
    id: (mockNotifications.length + 1).toString(),
    title: data.title ?? "",
    message: data.message ?? "",
    type: data.type ?? "system",
    time: now,
    unread: true,
    actionLabel: data.actionLabel ?? "",
    actionHref: data.actionHref ?? "",
  };

  // put new stuff at the top, just like your send form does
  mockNotifications.unshift(newItem);

  return NextResponse.json({ ok: true, created: true });
}