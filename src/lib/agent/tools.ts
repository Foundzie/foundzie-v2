// src/lib/agent/tools.ts

import {
  mockNotifications,
  type AppNotification,
  type NotificationType,
  type MediaKind,
} from "../../app/data/notifications";

import {
  addEvent,
  updateEvent,
  type SosStatus,
} from "@/app/api/sos/store";

import { addCallLog } from "@/app/api/calls/store";

/**
 * Names of tools the concierge agent can call.
 * (These should match whatever you define in spec.ts.)
 */
export type ToolName =
  | "open_sos_case"
  | "add_sos_note"
  | "log_outbound_call"
  | "broadcast_notification";

/* ------------------------------------------------------------------ */
/* 1. SOS tools – now wired into real SOS store                        */
/* ------------------------------------------------------------------ */

/**
 * open_sos_case
 *
 * OpenAI schema (spec.ts) defines:
 *   - category: "general" | "police" | "medical" | "fire"
 *   - description: string
 *   - locationHint: string
 *
 * We accept a flexible args shape so future upgrades don’t break:
 *   { category?, description?, locationHint?, message?, phone?, userId? }
 */
export async function openSosCase(args: any) {
  const category: string =
    args?.category ?? args?.type ?? "general";

  const description: string =
    args?.description ??
    args?.message ??
    args?.reason ??
    "SOS alert created from an agent conversation.";

  const location: string | undefined =
    args?.locationHint ?? args?.location ?? undefined;

  const phone: string | undefined =
    args?.phone ?? undefined;

  const userId: string | undefined =
    typeof args?.userId === "string" ? args.userId : undefined;

  const source: string =
    typeof args?.source === "string" ? args.source : "agent-chat";

  console.log("[agent tool] open_sos_case (agent)", {
    category,
    description,
    location,
    phone,
    userId,
    source,
    rawArgs: args,
  });

  // Create a real SOS event in the shared store
  const event = await addEvent({
    message: description,
    type: category,
    location,
    source,
    phone,
    userId,
  });

  // Add a small automatic action note so admins see context
  await updateEvent(event.id, {
    newActionText:
      "SOS case opened automatically from Foundzie agent chat.",
    newActionBy: "agent-foundzie",
  });

  return {
    id: event.id,
    userId: event.userId,
    status: event.status,
  };
}

/**
 * add_sos_note
 *
 * OpenAI schema (spec.ts) defines:
 *   - sosId: string
 *   - note: string
 *   - status?: "new" | "in-progress" | "resolved"
 *
 * We also accept { caseId } for flexibility.
 */
export async function addSosNote(args: {
  sosId?: string;
  caseId?: string;
  note: string;
  status?: SosStatus;
  userId?: string;
  by?: string;
}) {
  const sosId = args.sosId ?? args.caseId;

  if (!sosId) {
    console.warn(
      "[agent tool] add_sos_note called without sosId/caseId",
      args
    );
    return { ok: false as const, reason: "missing_sos_id" };
  }

  const patch: Parameters<typeof updateEvent>[1] = {
    newActionText: args.note,
    newActionBy: args.by ?? "agent-foundzie",
  };

  if (args.status) {
    patch.status = args.status;
  }
  if (typeof args.userId !== "undefined") {
    patch.userId = args.userId;
  }

  console.log("[agent tool] add_sos_note (agent)", {
    sosId,
    ...args,
  });

  const updated = await updateEvent(sosId, patch);

  return {
    ok: !!updated,
    id: sosId,
  };
}

/* ------------------------------------------------------------------ */
/* 2. Call log tool – now wired into real call log store              */
/* ------------------------------------------------------------------ */

export async function logOutboundCall(args: {
  userId?: string;
  userName?: string;
  phone?: string;
  direction?: "outbound" | "inbound";
  note?: string;
}) {
  const callId = `agent-call-${Date.now()}`;

  const phone = args.phone ?? "unknown";
  const direction: "outbound" = "outbound";

  console.log("[agent tool] log_outbound_call (agent)", {
    callId,
    ...args,
  });

  // Persist into the shared call log store
  const log = await addCallLog({
    id: callId,
    userId: args.userId ?? null,
    userName: args.userName ?? null,
    phone,
    note: args.note ?? "",
    direction,
  });

  return log;
}

/* ------------------------------------------------------------------ */
/* 3. Notification broadcast tool – uses existing mockNotifications    */
/* ------------------------------------------------------------------ */

export async function broadcastNotification(args: {
  title: string;
  message: string;
  unread?: boolean;
  actionLabel?: string;
  actionHref?: string;
  mediaUrl?: string;
  mediaKind?: MediaKind | null;
  mediaId?: string | null;
}): Promise<AppNotification> {
  // Make sure the type matches your NotificationType
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
    mediaKind: args.mediaKind ?? null,
    mediaId: args.mediaId ?? null,
  };

  // Put newest first so Admin UI sees it immediately
  mockNotifications.unshift(newItem);

  console.log("[agent tool] broadcast_notification", newItem);

  return newItem;
}

/* ------------------------------------------------------------------ */
/* 4. Tool registry – this is what /api/agent & runtime use           */
/* ------------------------------------------------------------------ */

export const toolImplementations = {
  open_sos_case: openSosCase,
  add_sos_note: addSosNote,
  log_outbound_call: logOutboundCall,
  broadcast_notification: broadcastNotification,
} as const;
