// src/lib/agent/tools.ts
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
/* Helper: stable base URL for server-side fetch                        */
/* ------------------------------------------------------------------ */
function getBaseUrl(): string {
  const explicit =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.APP_URL ||
    process.env.SITE_URL;

  if (explicit && explicit.trim()) return explicit.trim().replace(/\/+$/, "");

  const vercel = process.env.VERCEL_URL;
  if (vercel && vercel.trim())
    return `https://${vercel.trim().replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}

/* ------------------------------------------------------------------ */
/* 1) SOS tools                                                        */
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

  if (!updated) throw new Error(`SOS event not found for id=${args.sosId}`);

  console.log("[agent tool] add_sos_note →", updated);
  return updated;
}

/* ------------------------------------------------------------------ */
/* 2) Call log tool                                                    */
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
    typeof args.phone === "string" && args.phone.trim() ? args.phone.trim() : "";

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
/* 2b) call_third_party (RELAY MODE - NO CONFERENCE)                    */
/* ------------------------------------------------------------------ */
/**
 * call_third_party
 * ✅ Uses server endpoint /api/tools/call_third_party
 * That endpoint performs:
 * - redirect caller to /api/twilio/hold
 * - dial recipient via /api/twilio/relay (deliver message + capture reply)
 * - redirect caller back with result
 */
export async function call_third_party(args: {
  phone: string;
  message: string;
  roomId?: string;
  callSid?: string;
  fromPhone?: string; // optional
}) {
  const phone = typeof args.phone === "string" ? args.phone.trim() : "";
  const message = typeof args.message === "string" ? args.message.trim() : "";
  const roomId = typeof args.roomId === "string" ? args.roomId.trim() : "";
  const callSid = typeof args.callSid === "string" ? args.callSid.trim() : "";

  if (!phone) throw new Error("call_third_party: missing phone");
  if (!message) throw new Error("call_third_party: missing message");

  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/tools/call_third_party`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      phone,
      message,
      roomId: roomId || undefined,
      callSid: callSid || undefined,
      fromPhone:
        typeof args.fromPhone === "string" ? args.fromPhone.trim() : undefined,
    }),
  });

  const data = await res.json().catch(() => ({} as any));

  // Log for admin visibility
  try {
    const id = `agent-relay-${Date.now()}`;
    await addCallLog({
      id,
      userId: null,
      userName: null,
      phone,
      note: `Relay call: ${message}`.slice(0, 240),
      direction: "outbound",
    });
  } catch {}

  const ok = Boolean(data?.ok) && res.ok;

  const payload = {
    ok,
    mode: "relay" as const,
    phone,
    message,
    sessionId: data?.sessionId ?? null,
    steps: data?.steps ?? null,
    urls: data?.urls ?? null,
    error: ok ? null : data?.message ?? `HTTP ${res.status}`,
  };

  console.log("[agent tool] call_third_party →", payload);
  return payload;
}

/* ------------------------------------------------------------------ */
/* 3) Notification broadcast tool                                      */
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

  mockNotifications.unshift(newItem);
  console.log("[agent tool] broadcast_notification →", newItem);
  return newItem;
}

/* ------------------------------------------------------------------ */
/* 4) Places recommendation tool (M8c)                                 */
/* ------------------------------------------------------------------ */
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

  const rawLimit = Number.isFinite(args.limit as any) ? Number(args.limit) : 5;
  const limit = Math.max(1, Math.min(10, rawLimit || 5));

  let user: any | undefined;

  try {
    const usersStore = await import("@/app/api/users/store");
    const { getUser, findUserByRoomId } = usersStore as any;

    if (userId && typeof getUser === "function") user = await getUser(String(userId));
    if (!user && roomId && typeof findUserByRoomId === "function") {
      user = await findUserByRoomId(String(roomId));
    }
  } catch (err) {
    console.error("[agent tool] get_places_for_user: user lookup failed:", err);
  }

  const manualMode =
    args.manualMode === "child"
      ? "child"
      : args.manualMode === "normal"
      ? "normal"
      : null;

  const inferredMode = user?.interactionMode === "child" ? "child" : "normal";
  const mode = manualMode ?? inferredMode;

  const manualInterest =
    typeof args.manualInterest === "string" ? args.manualInterest.trim() : "";
  const userInterest =
    typeof user?.interest === "string" ? String(user.interest).trim() : "";
  const q = manualInterest || userInterest || "";

  const searchParams = new URLSearchParams();
  searchParams.set("mode", mode);
  searchParams.set("limit", String(limit));
  if (q) searchParams.set("q", q);

  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/places?${searchParams.toString()}`;

  const res = await fetch(url, { method: "GET", cache: "no-store" });

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
/* Tool registry                                                       */
/* ------------------------------------------------------------------ */
export const toolHandlers = {
  open_sos_case,
  add_sos_note,
  log_outbound_call,
  broadcast_notification,
  get_places_for_user,
  call_third_party,
} as const;

export const toolImplementations = toolHandlers;
