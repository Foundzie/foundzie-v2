// src/app/api/notifications/store.ts
import "server-only";
import { kvGetJSON, kvSetJSON } from "@/lib/kv/redis";

// Keep types aligned with your old mockNotifications objects
export type NotificationType =
  | "system"
  | "promo"
  | "sos"
  | "call"
  | "other";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: NotificationType | string;
  time: string;          // human label ("just now", "2 min ago", etc.)
  unread: boolean;
  actionLabel: string;
  actionHref: string;
  mediaUrl: string;
  mediaKind: string | null;
}

// Versioned key so we can change shape later if needed
const NOTIFICATIONS_KEY = "foundzie:notifications:v1";

// ---------- internal helpers ---------------------------------------------

async function loadAll(): Promise<NotificationItem[]> {
  const items = (await kvGetJSON<NotificationItem[]>(NOTIFICATIONS_KEY)) ?? [];

  // newest first – for now use array order (we prepend on write)
  return items.slice();
}

async function saveAll(items: NotificationItem[]): Promise<void> {
  await kvSetJSON(NOTIFICATIONS_KEY, items);
}

// ---------- public API ---------------------------------------------------

export async function listNotifications(): Promise<NotificationItem[]> {
  return loadAll();
}

export interface AddNotificationInput {
  title: string;
  message: string;
  type?: NotificationType | string;
  unread?: boolean;
  actionLabel?: string;
  actionHref?: string;
  mediaUrl?: string;
  mediaKind?: string | null;
  timeLabel?: string; // optional custom time text
}

/**
 * Simple "create new notification" helper.
 */
export async function addNotification(
  input: AddNotificationInput
): Promise<NotificationItem> {
  const current = await loadAll();

  const item: NotificationItem = {
    id: crypto.randomUUID(),
    title: input.title,
    message: input.message,
    type: input.type ?? "system",
    time: input.timeLabel ?? "just now",
    unread: input.unread ?? true,
    actionLabel: input.actionLabel ?? "",
    actionHref: input.actionHref ?? "",
    mediaUrl: input.mediaUrl ?? "",
    mediaKind: input.mediaKind ?? null,
  };

  const next = [item, ...current];
  await saveAll(next);
  return item;
}

/**
 * Upsert function designed specifically for the /api/notifications route.
 * Mirrors your old route.ts behaviour:
 * - if data.id matches an existing item → update it
 * - otherwise → create a new one and put it at the top
 */
export async function upsertNotificationFromPayload(data: any): Promise<{
  created: boolean;
  updated: boolean;
  item: NotificationItem;
}> {
  const current = await loadAll();
  const nowLabel = data.time ?? "just now";

  if (data.id) {
    const idx = current.findIndex((n) => n.id === data.id);
    if (idx !== -1) {
      const existing = current[idx];

      const updated: NotificationItem = {
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
        time: nowLabel,
        unread:
          typeof data.unread === "boolean" ? data.unread : existing.unread,
      };

      const next = [...current];
      next[idx] = updated;
      await saveAll(next);

      return { created: false, updated: true, item: updated };
    }
  }

  // Otherwise create a new one (same shape as your old route)
  const newItem: NotificationItem = {
    id: crypto.randomUUID(),
    title: data.title ?? "",
    message: data.message ?? "",
    type: data.type ?? "system",
    time: nowLabel,
    unread: typeof data.unread === "boolean" ? data.unread : true,
    actionLabel: data.actionLabel ?? "",
    actionHref: data.actionHref ?? "",
    mediaUrl: data.mediaUrl ?? "",
    mediaKind: data.mediaKind ?? null,
  };

  const next = [newItem, ...current];
  await saveAll(next);

  return { created: true, updated: false, item: newItem };
}
