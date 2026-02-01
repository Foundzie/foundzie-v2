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
  time: string; // human label ("just now", "2 min ago", etc.)
  unread: boolean;
  actionLabel: string;
  actionHref: string;
  mediaUrl: string;
  mediaKind: string | null;

  // ✅ M21 targeting support (backwards-compatible)
  campaignId?: string | null;          // which campaign emitted this
  targetRoomIds?: string[] | null;     // only show to these roomIds; null/empty => global
  deliveredToRoomId?: string | null;   // optional: if created for a single room
}

// Versioned key so we can change shape later if needed
const NOTIFICATIONS_KEY = "foundzie:notifications:v1";

// ---------- internal helpers ---------------------------------------------

async function loadAll(): Promise<NotificationItem[]> {
  const items = (await kvGetJSON<NotificationItem[]>(NOTIFICATIONS_KEY)) ?? [];
  return items.slice();
}

async function saveAll(items: NotificationItem[]): Promise<void> {
  await kvSetJSON(NOTIFICATIONS_KEY, items);
}

function normalizeRoomIds(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

// ---------- public API ---------------------------------------------------

export async function listNotifications(opts?: { roomId?: string }): Promise<NotificationItem[]> {
  const items = await loadAll();

  const roomId = String(opts?.roomId || "").trim();
  if (!roomId) return items;

  // ✅ If notification has targetRoomIds, only include if roomId matches.
  // ✅ If notification has no targets (null/empty), treat as global.
  return items.filter((n) => {
    const targets = Array.isArray(n.targetRoomIds) ? n.targetRoomIds : [];
    if (targets.length === 0) return true;
    return targets.includes(roomId);
  });
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
  timeLabel?: string;

  // ✅ M21 targeting support
  campaignId?: string | null;
  targetRoomIds?: string[] | string | null;
  deliveredToRoomId?: string | null;
}

/**
 * Simple "create new notification" helper.
 */
export async function addNotification(
  input: AddNotificationInput
): Promise<NotificationItem> {
  const current = await loadAll();

  const targetRoomIds = normalizeRoomIds(input.targetRoomIds);

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

    campaignId: input.campaignId ?? null,
    targetRoomIds: targetRoomIds.length ? targetRoomIds : null,
    deliveredToRoomId: input.deliveredToRoomId ?? null,
  };

  const next = [item, ...current];
  await saveAll(next);
  return item;
}

/**
 * Upsert function designed specifically for the /api/notifications route.
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
          data.actionLabel !== undefined ? data.actionLabel : existing.actionLabel,
        actionHref:
          data.actionHref !== undefined ? data.actionHref : existing.actionHref,
        mediaUrl:
          data.mediaUrl !== undefined ? data.mediaUrl : existing.mediaUrl,
        mediaKind:
          data.mediaKind !== undefined ? data.mediaKind : existing.mediaKind,
        time: nowLabel,
        unread: typeof data.unread === "boolean" ? data.unread : existing.unread,

        // keep targeting fields if provided
        campaignId: data.campaignId !== undefined ? data.campaignId : existing.campaignId ?? null,
        targetRoomIds:
          data.targetRoomIds !== undefined
            ? (normalizeRoomIds(data.targetRoomIds).length ? normalizeRoomIds(data.targetRoomIds) : null)
            : existing.targetRoomIds ?? null,
        deliveredToRoomId:
          data.deliveredToRoomId !== undefined ? data.deliveredToRoomId : existing.deliveredToRoomId ?? null,
      };

      const next = [...current];
      next[idx] = updated;
      await saveAll(next);

      return { created: false, updated: true, item: updated };
    }
  }

  const targetRoomIds = normalizeRoomIds(data.targetRoomIds);

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

    campaignId: data.campaignId ?? null,
    targetRoomIds: targetRoomIds.length ? targetRoomIds : null,
    deliveredToRoomId: data.deliveredToRoomId ?? null,
  };

  const next = [newItem, ...current];
  await saveAll(next);

  return { created: true, updated: false, item: newItem };
}
