// src/app/api/notifications/route.ts
import { NextResponse } from "next/server";
import { mockNotifications } from "@/app/data/notifications";

// this will live in memory while the server is running
const notifications = [...mockNotifications];

export async function GET() {
  // return newest first
  return NextResponse.json(notifications);
}

export async function POST(request: Request) {
  const body = await request.json();

  // basic shape — same as your mock file
  const newNotification = {
    id: Date.now().toString(),
    type: body.type ?? "system",
    title: body.title ?? "Untitled alert",
    message: body.message ?? "",
    time: body.time ?? "just now",
    unread: body.unread ?? true,
    actionLabel: body.actionLabel ?? undefined,
    actionHref: body.actionHref ?? undefined,
  };

  // put on top
  notifications.unshift(newNotification);

  return NextResponse.json(newNotification, { status: 201 });
}