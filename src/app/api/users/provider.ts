// src/app/api/users/provider.ts

import mockUsers, {
  type AdminUser as BaseAdminUser,
} from "@/app/data/users";
import { kvGetJSON, kvSetJSON } from "@/lib/kv/redis";

// Extend base type with optional tags + phone (same as before)
export type AdminUser = BaseAdminUser & {
  tags?: string[];
  phone?: string | null;
};
export type AdminUserInput = Partial<AdminUser>;

export interface UserProvider {
  list(): Promise<AdminUser[]>;
  get(id: string): Promise<AdminUser | undefined>;
  create(partial: AdminUserInput): Promise<AdminUser>;
  update(id: string, partial: AdminUserInput): Promise<AdminUser | undefined>;
  delete(id: string): Promise<boolean>;
  bulkUpdate(ids: string[], partial: AdminUserInput): Promise<number>;
}

/* -------------------------------------------------------------------------- */
/*                          KV-backed implementation                           */
/* -------------------------------------------------------------------------- */

const USERS_KEY = "foundzie:users:v1";

let inMemoryCache: AdminUser[] | null = null;

function normalizeTags(input: string[] | undefined | null): string[] {
  if (!input) return [];
  return input.map((t) => t.trim()).filter(Boolean);
}

async function loadAll(): Promise<AdminUser[]> {
  if (inMemoryCache) return inMemoryCache;

  const fromKv = (await kvGetJSON<AdminUser[]>(USERS_KEY)) ?? null;

  if (Array.isArray(fromKv) && fromKv.length > 0) {
    inMemoryCache = fromKv;
    return fromKv;
  }

  // Seed from mock users on first run
  const seeded: AdminUser[] = mockUsers.map((u) => ({
    ...u,
    tags: normalizeTags(u.tags),
    phone: u.phone ?? null,
  }));

  await kvSetJSON(USERS_KEY, seeded);
  inMemoryCache = seeded;
  return seeded;
}

async function saveAll(list: AdminUser[]): Promise<void> {
  inMemoryCache = list;
  await kvSetJSON(USERS_KEY, list);
}

function nextIdFrom(list: AdminUser[]): number {
  if (!list.length) return 1;
  const nums = list
    .map((u) => Number(u.id))
    .filter((n) => Number.isFinite(n));
  if (!nums.length) return 1;
  return Math.max(...nums) + 1;
}

const kvUserProvider: UserProvider = {
  async list() {
    return loadAll();
  },

  async get(id: string) {
    const list = await loadAll();
    return list.find((u) => String(u.id) === String(id));
  },

  async create(partial: AdminUserInput) {
    const list = await loadAll();
    const nextId = nextIdFrom(list);

    const user: AdminUser = {
      id: String(nextId),
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
      tags: normalizeTags(partial.tags),
      phone: partial.phone ?? null,
      roomId: partial.roomId ?? `user-${nextId}`,
      conciergeStatus: partial.conciergeStatus ?? "open",
      conciergeNote: partial.conciergeNote ?? "",
    };

    const updated = [user, ...list];
    await saveAll(updated);
    return user;
  },

  async update(id: string, partial: AdminUserInput) {
    const list = await loadAll();
    const idx = list.findIndex((u) => String(u.id) === String(id));
    if (idx === -1) return undefined;

    const current = list[idx];

    const tags =
      partial.tags === undefined
        ? current.tags
        : normalizeTags(partial.tags ?? []);

    const updated: AdminUser = {
      ...current,
      ...partial,
      tags,
      phone:
        partial.phone !== undefined ? partial.phone : current.phone ?? null,
      roomId: partial.roomId ?? current.roomId,
    };

    const next = [...list];
    next[idx] = updated;
    await saveAll(next);
    return updated;
  },

  async delete(id: string) {
    const list = await loadAll();
    const before = list.length;
    const next = list.filter((u) => String(u.id) !== String(id));
    if (next.length === before) return false;
    await saveAll(next);
    return true;
  },

  async bulkUpdate(ids: string[], partial: AdminUserInput) {
    const list = await loadAll();
    let count = 0;

    const next = list.map((u) => {
      if (!ids.includes(String(u.id))) return u;
      count++;

      const tags =
        partial.tags === undefined
          ? u.tags
          : normalizeTags(partial.tags ?? []);

      const updated: AdminUser = {
        ...u,
        ...partial,
        tags,
        phone:
          partial.phone !== undefined ? partial.phone : u.phone ?? null,
        roomId: partial.roomId ?? u.roomId,
      };

      return updated;
    });

    await saveAll(next);
    return count;
  },
};

/* -------------------------------------------------------------------------- */
/*                         export chosen user provider                         */
/* -------------------------------------------------------------------------- */

export const userProvider: UserProvider = kvUserProvider;
