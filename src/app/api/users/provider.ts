// src/app/api/users/provider.ts

import mockUsers, { type AdminUser } from "@/app/data/users";
import { createClient } from "redis";

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

/* ---------------- current in-memory implementation ---------------- */

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

/* ---------------- Redis-backed implementation ---------------- */

const REDIS_URL = process.env.REDIS_URL;

// IMPORTANT: type it as “whatever createClient returns”, not RedisClientType
let redisClient: ReturnType<typeof createClient> | null = null;

async function getRedisClient() {
  // if you're running locally with no env, we'll fall back to memory later
  if (!REDIS_URL) return null;

  if (redisClient) return redisClient;

  const client = createClient({ url: REDIS_URL });

  client.on("error", (err) => {
    console.error("[redis] error:", err);
  });

  await client.connect();
  redisClient = client;
  return client;
}

// we’ll keep everything under this one key
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
    const client = await getRedisClient();
    if (!client) return memoryProvider.list();

    // get current list
    let list = await redisGetAll();

    // first time: seed Redis with your mock users
    if (list.length === 0) {
      list = [...mockUsers];
      await redisSaveAll(list);
      await redisSetNextId(mockUsers.length + 1);
    }

    return list;
  },

  async get(id: string) {
    const client = await getRedisClient();
    if (!client) return memoryProvider.get(id);

    const list = await redisGetAll();
    return list.find((u) => u.id === id);
  },

  async create(partial: AdminUserInput) {
    const client = await getRedisClient();
    if (!client) return memoryProvider.create(partial);

    const list = await redisGetAll();
    const nextId = await redisGetNextId();

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
    };

    // newest first
    list.unshift(user);

    await redisSaveAll(list);
    await redisSetNextId(nextId + 1);

    return user;
  },

  async update(id: string, partial: AdminUserInput) {
    const client = await getRedisClient();
    if (!client) return memoryProvider.update(id, partial);

    const list = await redisGetAll();
    const index = list.findIndex((u) => u.id === id);
    if (index === -1) return undefined;

    const current = list[index];
    const updated: AdminUser = {
      ...current,
      ...partial,
    };

    list[index] = updated;
    await redisSaveAll(list);

    return updated;
  },
};

/* ---------------- export: prefer Redis, else memory ---------------- */

export const userProvider: UserProvider = REDIS_URL
  ? redisProvider
  : memoryProvider;

/* ---------------- KV version (future) ----------------
   When you're ready:
   1. npm install @vercel/kv
   2. add KV to your Vercel project (Storage → KV)
   3. uncomment the import and provider below
   4. change the export to use kvProvider
// import { kv } from "@vercel/kv";
// const kvKey = "foundzie:users";
// const kvProvider: UserProvider = { ... }
*/
