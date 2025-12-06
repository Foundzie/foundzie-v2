// src/lib/agent/tools.ts

/**
 * Foundzie V3 - Agent Tool Handlers
 * ----------------------------------
 * This file connects the OpenAI Agent → Foundzie backend state.
 * Instead of HTTP calls for SOS/Calls/Notifications, we call the
 * in-memory stores directly so changes appear instantly in Admin UI.
 *
 * NEW in M8c:
 * - get_places_for_user: lets the agent fetch curated places
 *   using your unified /api/places endpoint.
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
  const userId =
    typeof args.userId === "string" && args.userId.trim()
      ? args.userId.trim()
      : null;

  const phone =
    typeof args.phone === "string" && args.phone.trim()
      ? args.phone.trim()
      : "";

  const note =
    typeof args.note === "string" && args.note.trim()
      ? args.note.trim()
      : "";

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
/* 4. Places recommendation tool (M8c)                                */
/* ------------------------------------------------------------------ */

/**
 * get_places_for_user
 * -------------------
 * Used by the agent to fetch curated places from /api/places.
 *
 * We keep it simple to avoid coupling to the user store:
 * - mode: "normal" | "child"    (controls child-safe filter)
 * - interest: optional free-text (used as q=<interest>)
 *
 * The admin/agent prompt will usually say:
 *   "For this guest (child-safe, loves pizza), get places…"
 * and the model will choose the right mode + interest values.
 */
export async function get_places_for_user(args: {
  mode?: "normal" | "child";
  interest?: string;
  locationHint?: string; // reserved for future (e.g. city/neighborhood text)
}) {
  const mode = args.mode === "child" ? "child" : "normal";
  const q = (args.interest ?? "").trim();

  const searchParams = new URLSearchParams();
  searchParams.set("mode", mode);
  if (q) searchParams.set("q", q);

  // NOTE: relative URL works inside Next.js app router on the server.
  const res = await fetch(`/api/places?${searchParams.toString()}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[agent tool] get_places_for_user error:", res.status, text);
    throw new Error("Failed to fetch places for user");
  }

  const json = await res.json();

  const result = {
    usedMode: mode,
    usedQuery: q || null,
    places: json?.places ?? json ?? [],
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
