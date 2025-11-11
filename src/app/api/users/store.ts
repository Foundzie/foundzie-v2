// src/app/api/users/store.ts
import mockUsers, { type AdminUser } from "@/app/data/users";

// we’ll keep everything in a single global slot so the whole runtime
// (all route handlers that import this file) sees the same array.
const GLOBAL_KEY = "__foundzie_users__";

function getRuntimeUsers(): AdminUser[] {
  const g = globalThis as any;
  if (!g[GLOBAL_KEY]) {
    // first time: seed from mock data
    g[GLOBAL_KEY] = [...mockUsers];
  }
  return g[GLOBAL_KEY] as AdminUser[];
}

// narrow type for partial updates/creates
type AdminUserInput = Partial<AdminUser>;

/**
 * This is the pluggable layer.
 * Today: runtime memory (globalThis) → survives multiple requests in the same lambda.
 * Later: swap these methods to Vercel KV / DB without touching the API routes.
 */
const userProvider = {
  async list(): Promise<AdminUser[]> {
    const users = getRuntimeUsers();
    return users;
  },

  async get(id: string): Promise<AdminUser | undefined> {
    const users = getRuntimeUsers();
    return users.find((u) => u.id === id);
  },

  async create(partial: AdminUserInput): Promise<AdminUser> {
    const users = getRuntimeUsers();

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
    const users = getRuntimeUsers();
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

// ↓ public API (your routes already use these) — do NOT change route files
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
