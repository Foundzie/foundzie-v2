// src/lib/agent/tools.ts

import {
  mockNotifications,
  type AppNotification,
  type NotificationType,
  type MediaKind,
} from "../../app/data/notifications";

/**
 * Names of tools the concierge agent can call.
 * (These should match whatever you define in agentspec.ts.)
 */
export type ToolName =
  | "open_sos_case"
  | "add_sos_note"
  | "log_outbound_call"
  | "broadcast_notification";

/* ------------------------------------------------------------------ */
/* 1. SOS tools – currently debug stubs (safe no-ops, just logging)    */
/* ------------------------------------------------------------------ */

export async function openSosCase(args: {
  userId?: string;
  message: string;
}) {
  const id = `debug-sos-${Date.now()}`;

  console.log("[agent tool] open_sos_case", {
    id,
    ...args,
  });

  // For now just return a fake SOS object.
  return {
    id,
    userId: args.userId ?? null,
    message: args.message,
  };
}

export async function addSosNote(args: {
  caseId: string;
  note: string;
}) {
  console.log("[agent tool] add_sos_note", args);

  // Placeholder return – later this will write to real SOS storage.
  return {
    ok: true as const,
    caseId: args.caseId,
  };
}

/* ------------------------------------------------------------------ */
/* 2. Call log tool – matches what we already log in /api/calls        */
/* ------------------------------------------------------------------ */

export async function logOutboundCall(args: {
  userId?: string;
  phone: string;
  direction?: "outbound" | "inbound";
  note?: string;
}) {
  const callId = `debug-call-${Date.now()}`;

  console.log("[agent tool] log_outbound_call", {
    callId,
    ...args,
  });

  // Same shape as your existing admin call log rows
  return {
    callId,
    userId: args.userId ?? null,
    phone: args.phone,
    direction: args.direction ?? "outbound",
    note: args.note ?? "",
  };
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
/* 4. Tool registry – this is what /api/agent will call                */
/* ------------------------------------------------------------------ */

export const toolImplementations = {
  open_sos_case: openSosCase,
  add_sos_note: addSosNote,
  log_outbound_call: logOutboundCall,
  broadcast_notification: broadcastNotification,
} as const;
