// src/lib/kv/redis.ts
import "server-only";
import { Redis } from "@upstash/redis";

type Json = any;

declare global {
  // eslint-disable-next-line no-var
  var __foundzieMemoryKv: Map<string, string> | undefined;
}

/* ---------------- In-memory fallback ---------------- */

const memoryStore: Map<string, string> =
  globalThis.__foundzieMemoryKv ?? new Map<string, string>();

globalThis.__foundzieMemoryKv = memoryStore;

/* ---------------- Upstash (if configured) ---------------- */

const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

const redis =
  redisUrl && redisToken
    ? new Redis({
        url: redisUrl,
        token: redisToken,
      })
    : null;

// If redis fails once, stop using it for this process
let redisHealthy = !!redis;

function markRedisFailed(err: unknown, where: string) {
  console.error(`[kv.redis] Upstash error in ${where}:`, err);
  redisHealthy = false;
}

/* ---------------- Helpers ---------------- */

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    return null;
  }
}

/**
 * Read a JSON value from KV.
 * Uses Upstash when available; falls back to memory.
 */
export async function kvGetJSON<T = Json>(key: string): Promise<T | null> {
  if (!key) return null;

  // Upstash first
  if (redis && redisHealthy) {
    try {
      const raw = (await redis.get<string>(key)) ?? null;
      const parsed = safeParse<T>(raw);
      return parsed;
    } catch (err) {
      markRedisFailed(err, "kvGetJSON");
    }
  }

  // memory fallback
  const raw = memoryStore.get(key) ?? null;
  const parsed = safeParse<T>(raw);
  if (raw && parsed === null) {
    console.error("[kvGetJSON] Failed to parse JSON in memory for key:", key);
    memoryStore.delete(key);
  }
  return parsed;
}

/**
 * Write a JSON value to KV.
 * Uses Upstash when available; falls back to memory.
 */
export async function kvSetJSON(key: string, value: Json): Promise<void> {
  if (!key) return;

  const raw = JSON.stringify(value ?? null);

  if (redis && redisHealthy) {
    try {
      await redis.set(key, raw);
      return;
    } catch (err) {
      markRedisFailed(err, "kvSetJSON");
    }
  }

  memoryStore.set(key, raw);
}

/**
 * Optional debug helper
 */
export async function kvDebugGetRaw(key: string): Promise<{
  key: string;
  raw: string | null;
  parsed: any | null;
  source: "upstash" | "memory";
}> {
  if (!key) return { key, raw: null, parsed: null, source: "memory" };

  if (redis && redisHealthy) {
    try {
      const raw = (await redis.get<string>(key)) ?? null;
      return { key, raw, parsed: safeParse(raw), source: "upstash" };
    } catch (err) {
      markRedisFailed(err, "kvDebugGetRaw");
    }
  }

  const raw = memoryStore.get(key) ?? null;
  return { key, raw, parsed: safeParse(raw), source: "memory" };
}
