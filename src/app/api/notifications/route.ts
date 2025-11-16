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
      const existing = mockNotifications[idx];

      mockNotifications[idx] = {
        ...existing,
        title: data.title ?? existing.title,
        message: data.message ?? existing.message,
        type: data.type ?? existing.type,
        actionLabel:
          data.actionLabel !== undefined
            ? data.actionLabel
            : existing.actionLabel,
        actionHref:
          data.actionHref !== undefined
            ? data.actionHref
            : existing.actionHref,
        mediaUrl:
          data.mediaUrl !== undefined ? data.mediaUrl : existing.mediaUrl,
        mediaKind:
          data.mediaKind !== undefined ? data.mediaKind : existing.mediaKind,
        time: now,
        unread:
          typeof data.unread === "boolean" ? data.unread : existing.unread,
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
    unread: typeof data.unread === "boolean" ? data.unread : true,
    actionLabel: data.actionLabel ?? "",
    actionHref: data.actionHref ?? "",
    mediaUrl: data.mediaUrl ?? "",
    mediaKind: data.mediaKind ?? null,
  };

  // put new stuff at the top, just like your send form does
  mockNotifications.unshift(newItem);

  return NextResponse.json({ ok: true, created: true });
}
