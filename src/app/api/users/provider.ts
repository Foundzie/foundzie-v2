// src/app/api/users/provider.ts
import mockUsers, { type AdminUser } from "@/app/data/users";

// this is the shape our API needs for partial creates/updates
export type AdminUserInput = Partial<AdminUser>;

// this is the interface we can later back with KV / DB
export interface UserProvider {
  list(): Promise<AdminUser[]>;
  get(id: string): Promise<AdminUser | undefined>;
  create(partial: AdminUserInput): Promise<AdminUser>;
  update(
    id: string,
    partial: AdminUserInput
  ): Promise<AdminUser | undefined>;
}

// ------------ current in-memory implementation ------------

// we still start from mock data
let users: AdminUser[] = [...mockUsers];

const memoryProvider: UserProvider = {
  async list() {
    return users;
  },

  async get(id: string) {
    return users.find((u) => u.id === id);
  },

  async create(partial: AdminUserInput) {
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
      // extra admin/mobile fields
      interest: partial.interest ?? "",
      source: partial.source ?? "",
    };

    // newest on top, same as before
    users.unshift(user);
    return user;
  },

  async update(id: string, partial: AdminUserInput) {
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

// this is what the rest of the app will import
// later we can change ONLY this export to point to a KV-backed provider
export const userProvider: UserProvider = memoryProvider;
