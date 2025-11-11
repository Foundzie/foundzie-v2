// src/app/api/users/store.ts
import mockUsers, { type AdminUser } from "@/app/data/users";

// For now we stay in memory, but everything is async so later we can
// swap this to Vercel KV / DB without touching the API routes.
let users: AdminUser[] = [...mockUsers];

// narrow type for partial updates/creates
type AdminUserInput = Partial<AdminUser>;

export async function listUsers(): Promise<AdminUser[]> {
  return users;
}

export async function getUser(id: string): Promise<AdminUser | undefined> {
  return users.find((u) => u.id === id);
}

export async function createUser(partial: AdminUserInput): Promise<AdminUser> {
  const user: AdminUser = {
    id: (users.length + 1).toString(),
    name: partial.name ?? "Anonymous visitor",
    email: partial.email ?? "no-email@example.com",
    role: partial.role ?? "viewer",
    status: partial.status ?? "active",
    joined:
      partial.joined ??
      new Date().toLocaleString("en-US", {
        month: "short",
        year: "numeric",
      }),
    // the admin page has these extra fields now
    interest: partial.interest ?? "",
    source: partial.source ?? "",
  };

  // put newest on top (same pattern as before)
  users.unshift(user);
  return user;
}

export async function updateUser(
  id: string,
  partial: AdminUserInput
): Promise<AdminUser | undefined> {
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) return undefined;

  const current = users[index];
  const updated: AdminUser = {
    ...current,
    ...partial,
  };

  users[index] = updated;
  return updated;
}
