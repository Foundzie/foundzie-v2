// src/lib/agent/tools.ts
import "server-only";

import { addEvent, updateEvent, type SosStatus } from "@/app/api/sos/store";
import { addCallLog } from "@/app/api/calls/store";
import { startTwilioCall, redirectTwilioCall } from "@/lib/twilio";
import { kvGetJSON, kvSetJSON } from "@/lib/kv/redis";

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
/* KV key for active call mapping (set by /api/twilio/voice)            */
/* ------------------------------------------------------------------ */
function activeCallKey(roomId: string) {
  return `foundzie:twilio:active-call:${roomId}:v1`;
}

// Optional: store a "last seen call" pointer so tools can recover
const LAST_ACTIVE_KEY = "foundzie:twilio:last-active-call:v1";

type ActiveCallMapping = {
  roomId: string;
  callSid: string;
  from?: string;
  updatedAt?: string;
};

function normalizePhone(phone: string) {
  const p = (phone || "").trim();
  return p;
}

function safeConfName(raw: string) {
  return (raw || "")
    .replace(/[^a-zA-Z0-9:_-]/g, "-")
    .slice(0, 128);
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
/* 2b) M14: Conference bridge tool (FIXED + robust)                     */
/* ------------------------------------------------------------------ */
async function resolveActiveCallerCallSid(args: {
  roomId?: string;
  callSid?: string;
  fromPhone?: string;
}): Promise<{ callSid: string | null; source: string; mapping?: any }> {
  const callSidDirect = (args.callSid || "").trim();
  if (callSidDirect) return { callSid: callSidDirect, source: "direct" };

  const roomId = (args.roomId || "").trim();
  const fromPhone = normalizePhone(args.fromPhone || "");

  // 1) Try roomId → mapping
  if (roomId) {
    try {
      const mapping = await kvGetJSON<ActiveCallMapping>(activeCallKey(roomId));
      if (mapping?.callSid) {
        return { callSid: String(mapping.callSid).trim(), source: "roomId", mapping };
      }
    } catch (e) {
      console.warn("[agent tool] resolveActiveCallerCallSid roomId lookup failed", e);
    }
  }

  // 2) Try phone-based roomId (common when voice route picked phone:... automatically)
  if (fromPhone) {
    const phoneRoom = `phone:${fromPhone}`;
    try {
      const mapping = await kvGetJSON<ActiveCallMapping>(activeCallKey(phoneRoom));
      if (mapping?.callSid) {
        return { callSid: String(mapping.callSid).trim(), source: "phoneRoomId", mapping };
      }
    } catch (e) {
      console.warn("[agent tool] resolveActiveCallerCallSid phoneRoom lookup failed", e);
    }
  }

  // 3) Try "last active call" pointer (recovery)
  try {
    const last = await kvGetJSON<ActiveCallMapping>(LAST_ACTIVE_KEY);
    if (last?.callSid) {
      return { callSid: String(last.callSid).trim(), source: "lastActive", mapping: last };
    }
  } catch (e) {
    console.warn("[agent tool] resolveActiveCallerCallSid lastActive lookup failed", e);
  }

  return { callSid: null, source: "none" };
}

/**
 * call_third_party
 * - Redirects ACTIVE caller into a conference
 * - Calls third party and joins them into same conference
 */
export async function call_third_party(args: {
  phone: string;
  message: string;
  roomId?: string;
  callSid?: string;

  // optional (helps recover)
  fromPhone?: string;
}) {
  const phone = typeof args.phone === "string" ? args.phone.trim() : "";
  const message = typeof args.message === "string" ? args.message.trim() : "";

  const roomId = typeof args.roomId === "string" ? args.roomId.trim() : "";
  const callSidDirect = typeof args.callSid === "string" ? args.callSid.trim() : "";
  const fromPhone = typeof args.fromPhone === "string" ? args.fromPhone.trim() : "";

  if (!phone) throw new Error("call_third_party: missing phone");
  if (!message) throw new Error("call_third_party: missing message");

  const baseUrl = getBaseUrl();

  const resolved = await resolveActiveCallerCallSid({
    roomId,
    callSid: callSidDirect,
    fromPhone,
  });

  const callerCallSid = resolved.callSid || "";

  // Stable conference name:
  // prefer roomId, else callSid, else timestamp
  const confBase =
    roomId
      ? `foundzie-${roomId}`
      : callerCallSid
        ? `foundzie-${callerCallSid}`
        : `foundzie-${Date.now()}`;

  const confName = safeConfName(confBase);

  const joinUrl = `${baseUrl}/api/twilio/conference/join?conf=${encodeURIComponent(
    confName
  )}`;

  const bridgeUrl =
    `${baseUrl}/api/twilio/conference/bridge?conf=${encodeURIComponent(
      confName
    )}` + `&text=${encodeURIComponent(message)}`;

  // If we can bridge, do it
  let redirectedCaller = false;

  if (callerCallSid) {
    const redirectRes = await redirectTwilioCall(callerCallSid, joinUrl);
    redirectedCaller = !!redirectRes;
  }

  if (redirectedCaller) {
    // call third party into bridge url (say message then join conference)
    const outbound = await startTwilioCall(phone, {
      voiceUrl: bridgeUrl,
      note: message,
    });

    // Log
    try {
      const id = `agent-bridge-${Date.now()}`;
      await addCallLog({
        id,
        userId: null,
        userName: null,
        phone,
        note: `Bridge call (conf=${confName}) via ${resolved.source}: ${message}`.slice(
          0,
          240
        ),
        direction: "outbound",
      });
    } catch {}

    const payload = {
      ok: Boolean(outbound),
      mode: "conference" as const,
      phone,
      message,
      confName,
      callerCallSid,
      thirdPartySid: outbound?.sid ?? null,
      resolvedCallSidSource: resolved.source,
      resolvedMapping: resolved.mapping ?? null,
    };

    console.log("[agent tool] call_third_party →", payload);
    return payload;
  }

  // Fallback if no active callSid found
  const fallbackVoiceUrl =
    `${baseUrl}/api/twilio/message?text=` + encodeURIComponent(message);

  const fallback = await startTwilioCall(phone, {
    voiceUrl: fallbackVoiceUrl,
    note: message,
  });

  try {
    const id = `agent-thirdparty-${Date.now()}`;
    await addCallLog({
      id,
      userId: null,
      userName: null,
      phone,
      note: `Third-party message (no-bridge): ${message}`.slice(0, 240),
      direction: "outbound",
    });
  } catch {}

  const payload = {
    ok: Boolean(fallback),
    mode: "message-only" as const,
    phone,
    message,
    confName: null,
    callerCallSid: null,
    thirdPartySid: fallback?.sid ?? null,
    resolvedCallSidSource: resolved.source,
    resolvedMapping: resolved.mapping ?? null,
  };

  console.log("[agent tool] call_third_party fallback →", payload);
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
    typeof args.userId === "string" && args.userId.trim() ? args.userId.trim() : null;

  const roomId =
    typeof args.roomId === "string" && args.roomId.trim() ? args.roomId.trim() : null;

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

  const manualInterest = typeof args.manualInterest === "string" ? args.manualInterest.trim() : "";
  const userInterest = typeof user?.interest === "string" ? String(user.interest).trim() : "";
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
