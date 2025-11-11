// src/app/api/users/store.ts
import mockUsers, { type AdminUser } from "@/app/data/users";

// we still start from mock data
let users: AdminUser[] = [...mockUsers];

// narrow type for partial updates/creates
type AdminUserInput = Partial<AdminUser>;

/**
 * This is the pluggable layer.
 * Right now it just uses the in-memory array.
 * Later we can replace ONLY this object with Vercel KV / DB calls.
 */
const userProvider = {
  async list(): Promise<AdminUser[]> {
    return users;
  },

  async get(id: string): Promise<AdminUser | undefined> {
    return users.find((u) => u.id === id);
  },

  async create(partial: AdminUserInput): Promise<AdminUser> {
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
      // extra fields you added for admin/mobile
      interest: partial.interest ?? "",
      source: partial.source ?? "",
    };

    // newest on top like before
    users.unshift(user);
    return user;
  },

  async update(
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
  },
};

// ↓ public API (what your routes already use) stays the same

export async function listUsers(): Promise<AdminUser[]> {
  return userProvider.list();
}

export async function getUser(id: string): Promise<AdminUser | undefined> {
  return userProvider.get(id);
}

export async function createUser(
  partial: AdminUserInput
): Promise<AdminUser> {
  return userProvider.create(partial);
}

export async function updateUser(
  id: string,
  partial: AdminUserInput
): Promise<AdminUser | undefined> {
  return userProvider.update(id, partial);
}
