// src/lib/agent/tools.ts

/**
 * Foundzie V3 - Agent Tool Handlers
 * ----------------------------------
 * This file connects the OpenAI Agent → Foundzie backend state.
 * Instead of HTTP calls, we call the in-memory stores directly so
 * SOS + Calls + Notifications update instantly in the Admin UI.
 */

import "server-only";

import {
  addEvent,
  updateEvent,
  type SosStatus,
} from "@/app/api/sos/store";
import { addCallLog } from "@/app/api/calls/store";
import {
  mockNotifications,
  type AppNotification,
  type NotificationType,
  type MediaKind,
} from "@/app/data/notifications";

/* ------------------------------------------------------------------ */
/* 1. SOS tools                                                        */
/* ------------------------------------------------------------------ */

export async function open_sos_case(args: {
  category: "general" | "police" | "medical" | "fire";
  description: string;
  locationHint?: string;
}) {
  const event = await addEvent({
    message: args.description,
    type: args.category,
    location: args.locationHint ?? undefined,
    source: "agent",
  });

  console.log("[agent tool] open_sos_case →", event);
  return event;
}

export async function add_sos_note(args: {
  sosId: string;
  note: string;
  status?: SosStatus;
}) {
  const updated = await updateEvent(args.sosId, {
    newActionText: args.note,
    status: args.status,
  });

  if (!updated) {
    throw new Error(`SOS event not found for id=${args.sosId}`);
  }

  console.log("[agent tool] add_sos_note →", updated);
  return updated;
}

/* ------------------------------------------------------------------ */
/* 2. Call log tool                                                    */
/* ------------------------------------------------------------------ */

export async function log_outbound_call(args: {
  userId?: string;
  phone?: string;
  note: string;
}) {
  const id = `agent-call-${Date.now()}`;

  const log = await addCallLog({
    id,
    userId: args.userId ?? null,
    userName: null,
    phone: args.phone ?? "unknown",
    note: args.note,
    direction: "outbound",
  });

  console.log("[agent tool] log_outbound_call →", log);
  return log;
}

/* ------------------------------------------------------------------ */
/* 3. Notification broadcast tool                                      */
/* ------------------------------------------------------------------ */

export async function broadcast_notification(args: {
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
  mediaUrl?: string;
  mediaKind?: "image" | "gif" | "link" | "other";
  unread?: boolean;
}) {
  const safeType: NotificationType = "system";
  const now = "just now";

  const newItem: AppNotification = {
    id: (mockNotifications.length + 1).toString(),
    title: args.title,
    message: args.message,
    type: safeType,
    time: now,
    unread:
      typeof args.unread === "boolean" ? args.unread : true,
    actionLabel: args.actionLabel ?? "",
    actionHref: args.actionHref ?? "",
    mediaUrl: args.mediaUrl ?? "",
    mediaKind: (args.mediaKind as MediaKind | undefined) ?? null,
    mediaId: null,
  };

  mockNotifications.unshift(newItem);

  console.log("[agent tool] broadcast_notification →", newItem);
  return newItem;
}

/* ------------------------------------------------------------------ */
/* 4. Tool registry – used by runtime + /api/agent                     */
/* ------------------------------------------------------------------ */

export const toolHandlers = {
  open_sos_case,
  add_sos_note,
  log_outbound_call,
  broadcast_notification,
} as const;

// Alias used by runtime.ts and api/agent/route.ts
export const toolImplementations = toolHandlers;
