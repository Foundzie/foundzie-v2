// src/app/api/users/store.ts

import mockUsers, { type AdminUser } from "@/app/data/users";

// single in-memory array that ALL user routes will share
let users: AdminUser[] = [...mockUsers];

export function listUsers(): AdminUser[] {
  return users;
}

export function getUser(id: string): AdminUser | undefined {
  return users.find((u) => u.id === id);
}

export function createUser(partial: Partial<AdminUser>): AdminUser {
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
    interest: partial.interest,
    source: partial.source,
  };

  // newest on top
  users.unshift(user);
  return user;
}

export function updateUser(
  id: string,
  partial: Partial<AdminUser>
): AdminUser | undefined {
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
