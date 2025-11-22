// src/lib/kv/redis.ts
import "server-only";
import { Redis } from "@upstash/redis";

declare global {
  // eslint-disable-next-line no-var
  var __foundzieMemoryKv: Map<string, string> | undefined;
}

type Json = any;

// --- shared in-memory fallback (for when Redis env is not valid) ---
const memoryStore: Map<string, string> =
  globalThis.__foundzieMemoryKv ?? new Map<string, string>();

globalThis.__foundzieMemoryKv = memoryStore;

// --- helper to build a safe Redis client, or return null -------------
let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;

  const url =
    process.env.UPSTASH_REDIS_REST_URL ??
    process.env.REDIS_URL ??
    "";

  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    process.env.REDIS_TOKEN ??
    "";

  const hasLikelyValidCreds =
    typeof url === "string" &&
    url.startsWith("http") &&
    typeof token === "string" &&
    token.length > 10;

  if (!hasLikelyValidCreds) {
    // No valid Redis creds → use in-memory store only
    console.warn(
      "[kv] No valid Redis URL/token found. Falling back to in-memory KV store (data will reset on server restart)."
    );
    return null;
  }

  redisClient = new Redis({ url, token });
  return redisClient;
}

// --- public helpers ---------------------------------------------------

export async function kvGetJSON<T = Json>(key: string): Promise<T | null> {
  const client = getRedisClient();

  // In-memory fallback
  if (!client) {
    const raw = memoryStore.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch (err) {
      console.error(
        "[kvGetJSON] Failed to parse JSON in memory for key:",
        key,
        err
      );
      // auto-heal memory store
      memoryStore.delete(key);
      return null;
    }
  }

  const raw = (await client.get<string>(key)) ?? null;
  if (raw == null) return null;

  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(
      "[kvGetJSON] Failed to parse JSON for key:",
      key,
      err,
      "raw value:",
      raw
    );

    // 🔧 AUTO-HEAL: delete corrupted value so next write is clean
    try {
      await client.del(key);
      console.warn("[kvGetJSON] Deleted corrupted key from Redis:", key);
    } catch (delErr) {
      console.error("[kvGetJSON] Failed to delete corrupted key:", key, delErr);
    }

    return null;
  }
}

export async function kvSetJSON(key: string, value: Json): Promise<void> {
  const client = getRedisClient();
  const raw = JSON.stringify(value ?? null);

  if (!client) {
    // In-memory fallback
    memoryStore.set(key, raw);
    return;
  }

  await client.set(key, raw);
}

/**
 * Debug helper used only by /api/dev/seed.
 * Returns both the raw stored value and a best-effort parsed JSON version.
 */
export async function kvDebugGetRaw(key: string): Promise<{
  raw: string | null;
  parsed: any | null;
}> {
  const client = getRedisClient();

  // In-memory fallback
  if (!client) {
    const raw = memoryStore.get(key) ?? null;
    let parsed: any = null;
    if (raw != null) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
    }
    return { raw, parsed };
  }

  const raw = (await client.get<string>(key)) ?? null;
  let parsed: any = null;
  if (raw != null) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  }

  return { raw, parsed };
}
