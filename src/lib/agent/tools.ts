// src/lib/agent/tools.ts

/**
 * Foundzie V3 - Agent Tool Handlers
 * ----------------------------------
 * This file connects the OpenAI Agent → Foundzie backend state.
 * Instead of HTTP calls for SOS/Calls/Notifications, we call the
 * in-memory stores directly so changes appear instantly in Admin UI.
 *
 * Compatibility quick fixes:
 * 1) Tool implementation args MUST match the schema in spec.ts (coreTools).
 * 2) Server-side fetch must use an ABSOLUTE URL (relative /api/... is not reliable here).
 */

import "server-only";

import { addEvent, updateEvent, type SosStatus } from "@/app/api/sos/store";
import { addCallLog } from "@/app/api/calls/store";

import {
  mockNotifications,
  type AppNotification,
  type NotificationType,
  type MediaKind,
} from "@/app/data/notifications";

/* ------------------------------------------------------------------ */
/*  Helper: stable base URL for server-side fetch                       */
/* ------------------------------------------------------------------ */

function getBaseUrl(): string {
  // Prefer explicit app URL if you have it
  const explicit =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.APP_URL ||
    process.env.SITE_URL;

  if (explicit && explicit.trim()) {
    return explicit.trim().replace(/\/+$/, "");
  }

  // Vercel provides hostname without scheme
  const vercel = process.env.VERCEL_URL;
  if (vercel && vercel.trim()) {
    return `https://${vercel.trim().replace(/\/+$/, "")}`;
  }

  // Local dev fallback
  return "http://localhost:3000";
}

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
  const userId =
    typeof args.userId === "string" && args.userId.trim()
      ? args.userId.trim()
      : null;

  const phone =
    typeof args.phone === "string" && args.phone.trim()
      ? args.phone.trim()
      : "";

  const note =
    typeof args.note === "string" && args.note.trim() ? args.note.trim() : "";

  if (!phone) {
    throw new Error(
      "Missing phone number. Provide a phone or a userId linked to a phone."
    );
  }

  const id = `agent-call-${Date.now()}`;

  const log = await addCallLog({
    id,
    userId,
    userName: null,
    phone,
    note,
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
    unread: typeof args.unread === "boolean" ? args.unread : true,
    actionLabel: args.actionLabel ?? "",
    actionHref: args.actionHref ?? "",
    mediaUrl: args.mediaUrl ?? "",
    mediaKind: (args.mediaKind as MediaKind | undefined) ?? null,
    mediaId: null,
  };

  // This mutates the in-memory list used by /api/notifications
  mockNotifications.unshift(newItem);

  console.log("[agent tool] broadcast_notification →", newItem);
  return newItem;
}

/* ------------------------------------------------------------------ */
/* 4. Places recommendation tool (M8c)                                 */
/* ------------------------------------------------------------------ */

/**
 * get_places_for_user
 * -------------------
 * IMPORTANT: This function signature MUST match the schema in spec.ts (coreTools).
 *
 * Schema fields we support:
 * - userId?: string
 * - roomId?: string
 * - limit?: number (1..10)
 * - manualInterest?: string
 * - manualMode?: "normal" | "child"
 *
 * Behavior:
 * - If manualMode provided → use it
 * - Else if user found → use user's interactionMode
 * - Else → normal
 *
 * - Query interest:
 *   manualInterest > user.interest > empty
 *
 * - Uses ABSOLUTE URL for server fetch.
 */
export async function get_places_for_user(args: {
  userId?: string;
  roomId?: string;
  limit?: number;
  manualInterest?: string;
  manualMode?: "normal" | "child";
}) {
  const userId =
    typeof args.userId === "string" && args.userId.trim()
      ? args.userId.trim()
      : null;

  const roomId =
    typeof args.roomId === "string" && args.roomId.trim()
      ? args.roomId.trim()
      : null;

  // clamp limit 1..10 (default 5)
  const rawLimit = Number.isFinite(args.limit as any) ? Number(args.limit) : 5;
  const limit = Math.max(1, Math.min(10, rawLimit || 5));

  // Find user (optional) to infer interest + mode
  let user: any | undefined;

  try {
    const usersStore = await import("@/app/api/users/store");
    const { getUser, findUserByRoomId } = usersStore as any;

    if (userId && typeof getUser === "function") {
      user = await getUser(String(userId));
    }

    if (!user && roomId && typeof findUserByRoomId === "function") {
      user = await findUserByRoomId(String(roomId));
    }
  } catch (err) {
    console.error("[agent tool] get_places_for_user: user lookup failed:", err);
  }

  // Decide mode
  const manualMode =
    args.manualMode === "child" ? "child" : args.manualMode === "normal" ? "normal" : null;

  const inferredMode =
    user?.interactionMode === "child" ? "child" : "normal";

  const mode = manualMode ?? inferredMode;

  // Decide query/interest
  const manualInterest =
    typeof args.manualInterest === "string" ? args.manualInterest.trim() : "";

  const userInterest =
    typeof user?.interest === "string" ? String(user.interest).trim() : "";

  const q = manualInterest || userInterest || "";

  // Build request to unified /api/places
  const searchParams = new URLSearchParams();
  searchParams.set("mode", mode);
  searchParams.set("limit", String(limit));
  if (q) searchParams.set("q", q);

  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/places?${searchParams.toString()}`;

  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
    // Keep it simple; no headers required for your current /api/places route
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[agent tool] get_places_for_user error:", res.status, text);
    throw new Error("Failed to fetch places for user");
  }

  const json = await res.json().catch(() => ({} as any));

  const places = (json?.places ?? json ?? []) as any[];

  const result = {
    usedUserId: userId,
    usedRoomId: roomId,
    usedMode: mode,
    usedQuery: q || null,
    usedLimit: limit,
    places,
  };

  console.log("[agent tool] get_places_for_user →", result);
  return result;
}

/* ------------------------------------------------------------------ */
/* 5. Tool registry – used by runtime + /api/agent                     */
/* ------------------------------------------------------------------ */

export const toolHandlers = {
  open_sos_case,
  add_sos_note,
  log_outbound_call,
  broadcast_notification,
  get_places_for_user,
} as const;

// alias expected by your existing runtime
export const toolImplementations = toolHandlers;
