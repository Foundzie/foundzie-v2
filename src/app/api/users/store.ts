// src/app/api/users/store.ts
import type { AdminUser as BaseAdminUser } from "@/app/data/users";
import { userProvider, type AdminUserInput } from "./provider";

// Our API returns the base user + optional tags + phone (non-breaking)
export type AdminUser = BaseAdminUser & {
  tags?: string[];
  phone?: string | null;
};

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

// used later for mass activate/disable
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
  const all = await listUsers();
  return all.find((u) => String(u.roomId).trim() === roomId.trim());
}

// Ensure there is at least one user row for this roomId.
// If it exists, return it. If not, create a lightweight "Anonymous visitor".
export async function ensureUserForRoom(
  roomId: string,
  opts?: {
    name?: string;
    email?: string | null;
    source?: string;
    tags?: string[];
  }
): Promise<AdminUser> {
  const trimmed = roomId.trim();
  if (!trimmed) {
    throw new Error("ensureUserForRoom called with empty roomId");
  }

  const existing = await findUserByRoomId(trimmed);
  if (existing) return existing;

  const nowIso = new Date().toISOString();

  const defaultName =
    opts?.name ?? `Anonymous visitor ${trimmed.slice(0, 6) || ""}`;
  const email = opts?.email ?? "no-email@example.com";
  const source = opts?.source ?? "mobile-concierge";
  const tags = opts?.tags ?? ["concierge-request"];

  // AdminUserInput already allows partial fields (joined is optional in your usage)
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
  } as AdminUserInput);

  return created;
}
