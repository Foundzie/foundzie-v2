// src/app/api/users/store.ts

import type { AdminUser as BaseAdminUser } from "@/app/data/users";
import { userProvider, type AdminUserInput } from "./provider";

// Our API returns the base user + optional tags + phone + interactionMode
export type AdminUser = BaseAdminUser & {
  tags?: string[];
  phone?: string | null;
  interactionMode?: "normal" | "child";
};

/* ------------------------------------------------------------------ */
/*  Basic CRUD wrappers                                               */
/* ------------------------------------------------------------------ */

export async function listUsers(): Promise<AdminUser[]> {
  return userProvider.list();
}

export async function getUser(id: string): Promise<AdminUser | undefined> {
  return userProvider.get(id);
}

export async function createUser(partial: AdminUserInput): Promise<AdminUser> {
  return userProvider.create(partial);
}

export async function updateUser(
  id: string,
  partial: AdminUserInput
): Promise<AdminUser | undefined> {
  return userProvider.update(id, partial);
}

export async function deleteUser(id: string): Promise<boolean> {
  return userProvider.delete(id);
}

// Used later for mass activate/disable
export async function bulkUpdateUsers(
  ids: string[],
  partial: AdminUserInput
): Promise<number> {
  return userProvider.bulkUpdate(ids, partial);
}

/* ------------------------------------------------------------------ */
/*  NEW: roomId helpers for chat ↔ users                              */
/* ------------------------------------------------------------------ */

// Find a user row that is already linked to this chat roomId
export async function findUserByRoomId(
  roomId: string
): Promise<AdminUser | undefined> {
  const trimmed = roomId.trim();
  if (!trimmed) return undefined;

  const all = await listUsers();
  return all.find(
    (u) => typeof u.roomId === "string" && u.roomId.trim() === trimmed
  );
}

/**
 * Ensure there is at least one user row for this roomId.
 *
 * - If it exists, return it.
 * - If not, create a lightweight "Anonymous visitor" (or use the provided name).
 *
 * This is used by the mobile chat profile endpoint /api/users/room/[roomId]
 * so that the admin panel can always find a matching user for a chat room.
 */
export async function ensureUserForRoom(
  roomId: string,
  opts?: {
    name?: string;
    email?: string | null;
    source?: string;
    tags?: string[];
    interactionMode?: "normal" | "child";
  }
): Promise<AdminUser> {
  const trimmed = roomId.trim();
  if (!trimmed) {
    throw new Error("ensureUserForRoom called with empty roomId");
  }

  // If a user is already linked to this room, just return it.
  const existing = await findUserByRoomId(trimmed);
  if (existing) return existing;

  const nowIso = new Date().toISOString();

  // Prefer the explicit name we got from the mobile client.
  const defaultName =
    (opts?.name && opts.name.trim()) ||
    `Anonymous visitor ${trimmed.slice(0, 6) || ""}`;

  const email = opts?.email ?? "no-email@example.com";

  // IMPORTANT: for mobile chat we default the source to "mobile-chat"
  const source = opts?.source ?? "mobile-chat";

  const tags =
    Array.isArray(opts?.tags) && opts!.tags.length > 0
      ? opts!.tags
      : ["concierge-request"];

  const interactionMode =
    opts?.interactionMode === "child" ? "child" : "normal";

  const created = await createUser({
    name: defaultName,
    email,
    phone: null,
    role: "viewer",
    status: "collected",
    joined: nowIso,
    interest: "",
    source,
    tags,
    roomId: trimmed,
    interactionMode,
  } as AdminUserInput);

  return created;
}
