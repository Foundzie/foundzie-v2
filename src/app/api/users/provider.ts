// src/app/api/users/provider.ts
import mockUsers, { type AdminUser as BaseAdminUser } from "@/app/data/users";
import { createClient } from "redis";

// Extend base type with optional tags (keeps old code working)
export type AdminUser = BaseAdminUser & { tags?: string[] };
export type AdminUserInput = Partial<AdminUser>;

export interface UserProvider {
  list(): Promise<AdminUser[]>;
  get(id: string): Promise<AdminUser | undefined>;
  create(partial: AdminUserInput): Promise<AdminUser>;
  update(id: string, partial: AdminUserInput): Promise<AdminUser | undefined>;
  delete(id: string): Promise<boolean>;
  bulkUpdate(ids: string[], partial: AdminUserInput): Promise<number>;
}

/* ---------------------- current in-memory implementation ------------------- */

let users: AdminUser[] = [...mockUsers];

const memoryProvider: UserProvider = {
  async list() {
    return users;
  },
  async get(id: string) {
    return users.find((u) => String(u.id) === String(id));
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
        new Date().toLocaleString("en-US", { month: "short", year: "numeric" }),
      interest: partial.interest ?? "",
      source: partial.source ?? "",
      tags: (partial.tags ?? []).map((t) => t.trim()).filter(Boolean),
    };
    users.unshift(user);
    return user;
  },
  async update(id: string, partial: AdminUserInput) {
    const idx = users.findIndex((u) => String(u.id) === String(id));
    if (idx === -1) return undefined;
    const current = users[idx];

    const tags =
      partial.tags === undefined
        ? current.tags
        : (partial.tags ?? []).map((t) => t.trim()).filter(Boolean);

    const updated: AdminUser = { ...current, ...partial, tags };
    users[idx] = updated;
    return updated;
  },
  async delete(id: string) {
    const before = users.length;
    users = users.filter((u) => String(u.id) !== String(id));
    return users.length < before;
  },
  async bulkUpdate(ids: string[], partial: AdminUserInput) {
    let count = 0;
    users = users.map((u) => {
      if (ids.includes(String(u.id))) {
        count++;
        return { ...u, ...partial };
      }
      return u;
    });
    return count;
  },
};

/* -------------------- Redis-backed (kept compatible) ---------------------- */

const REDIS_URL = process.env.REDIS_URL;
let redisClient: ReturnType<typeof createClient> | null = null;

async function getRedisClient() {
  if (!REDIS_URL) return null;
  if (redisClient) return redisClient;
  const client = createClient({ url: REDIS_URL });
  client.on("error", (err) => console.error("[redis] error:", err));
  await client.connect();
  redisClient = client;
  return client;
}

const USERS_KEY = "foundzie:users";
const NEXT_ID_KEY = "foundzie:users:nextId";

async function redisGetAll(): Promise<AdminUser[]> {
  const client = await getRedisClient();
  if (!client) return [];
  const raw = await client.get(USERS_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as AdminUser[];
}
async function redisSaveAll(list: AdminUser[]) {
  const client = await getRedisClient();
  if (!client) return;
  await client.set(USERS_KEY, JSON.stringify(list));
}
async function redisGetNextId(): Promise<number> {
  const client = await getRedisClient();
  if (!client) return 1;
  const raw = await client.get(NEXT_ID_KEY);
  return raw ? Number(raw) : 1;
}
async function redisSetNextId(n: number) {
  const client = await getRedisClient();
  if (!client) return;
  await client.set(NEXT_ID_KEY, String(n));
}

const redisProvider: UserProvider = {
  async list() {
    const list = await redisGetAll();
    if (list.length === 0) {
      const seeded: AdminUser[] = mockUsers.map((u) => ({ ...u, tags: [] }));
      await redisSaveAll(seeded);
      await redisSetNextId(mockUsers.length + 1);
      return seeded;
    }
    return list;
  },
  async get(id: string) {
    const list = await redisGetAll();
    return list.find((u) => String(u.id) === String(id));
  },
  async create(partial: AdminUserInput) {
    let list = await redisGetAll();
    const nextId = await redisGetNextId();

    const user: AdminUser = {
      id: String(nextId),
      name: partial.name ?? "Anonymous visitor",
      email: partial.email ?? "no-email@example.com",
      role: partial.role ?? "viewer",
      status: partial.status ?? "active",
      joined:
        partial.joined ??
        new Date().toLocaleString("en-US", { month: "short", year: "numeric" }),
      interest: partial.interest ?? "",
      source: partial.source ?? "",
      tags: (partial.tags ?? []).map((t) => t.trim()).filter(Boolean),
    };

    list.unshift(user);
    await redisSaveAll(list);
    await redisSetNextId(nextId + 1);
    return user;
  },
  async update(id: string, partial: AdminUserInput) {
    let list = await redisGetAll();
    const idx = list.findIndex((u) => String(u.id) === String(id));
    if (idx === -1) return undefined;

    const current = list[idx];
    const tags =
      partial.tags === undefined
        ? current.tags
        : (partial.tags ?? []).map((t) => t.trim()).filter(Boolean);

    const updated: AdminUser = { ...current, ...partial, tags };
    list[idx] = updated;
    await redisSaveAll(list);
    return updated;
  },
  async delete(id: string) {
    let list = await redisGetAll();
    const before = list.length;
    list = list.filter((u) => String(u.id) !== String(id));
    await redisSaveAll(list);
    return list.length < before;
  },
  async bulkUpdate(ids: string[], partial: AdminUserInput) {
    let list = await redisGetAll();
    let count = 0;
    list = list.map((u) => {
      if (ids.includes(String(u.id))) {
        count++;
        return { ...u, ...partial };
      }
      return u;
    });
    await redisSaveAll(list);
    return count;
  },
};

/* --------- export: prefer Redis if configured, else in-memory ------------- */
export const userProvider: UserProvider = REDIS_URL ? redisProvider : memoryProvider;

/* ---------------- KV version notes (future) --------------------------------
When ready:
1) npm install @vercel/kv
2) add KV to your Vercel project
3) swap export to kvProvider (same interface)
--------------------------------------------------------------------------- */
