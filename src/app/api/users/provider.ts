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

// ------------- current in-memory implementation -------------

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
// right now we point to in-memory
export const userProvider: UserProvider = memoryProvider;

/*
  ----------------- KV version (future) -----------------

  When you're ready:

  1. npm install @vercel/kv
  2. add KV to your Vercel project (Storage → KV)
  3. uncomment the import below and the kvProvider, then
     change the export at the bottom to use kvProvider

  // import { kv } from "@vercel/kv";

  const kvKey = "foundzie:users";

  const kvProvider: UserProvider = {
    async list() {
      const list = (await kv.get<AdminUser[]>(kvKey)) ?? [];
      return list;
    },
    async get(id: string) {
      const list = (await kv.get<AdminUser[]>(kvKey)) ?? [];
      return list.find((u) => u.id === id);
    },
    async create(partial: AdminUserInput) {
      const list = (await kv.get<AdminUser[]>(kvKey)) ?? [];
      const user: AdminUser = {
        id: (list.length + 1).toString(),
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
        interest: partial.interest ?? "",
        source: partial.source ?? "",
      };
      list.unshift(user);
      await kv.set(kvKey, list);
      return user;
    },
    async update(id: string, partial: AdminUserInput) {
      const list = (await kv.get<AdminUser[]>(kvKey)) ?? [];
      const index = list.findIndex((u) => u.id === id);
      if (index === -1) return undefined;
      const updated: AdminUser = { ...list[index], ...partial };
      list[index] = updated;
      await kv.set(kvKey, list);
      return updated;
    },
  };

  // then switch this:
  // export const userProvider: UserProvider = kvProvider;
*/
