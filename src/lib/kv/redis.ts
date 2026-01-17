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

// Instead of permanently disabling Redis, use a short cooldown and retry later.
let redisDisabledUntil = 0; // epoch ms

function isRedisAllowedNow() {
  return !!redis && Date.now() >= redisDisabledUntil;
}

function markRedisFailed(err: unknown, where: string) {
  console.error(`[kv.redis] Upstash error in ${where}:`, err);
  // Back off briefly (serverless transient failures happen)
  redisDisabledUntil = Date.now() + 15_000; // 15 seconds
}

/* ---------------- Helpers ---------------- */

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeStringify(value: any) {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return "null";
  }
}

/**
 * Read a JSON value from KV.
 * Uses Upstash when available; falls back to memory.
 */
export async function kvGetJSON<T = Json>(key: string): Promise<T | null> {
  if (!key) return null;

  if (isRedisAllowedNow()) {
    try {
      const raw = (await redis!.get<string>(key)) ?? null;
      return safeParse<T>(raw);
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

  const raw = safeStringify(value);

  if (isRedisAllowedNow()) {
    try {
      await redis!.set(key, raw);
      return;
    } catch (err) {
      markRedisFailed(err, "kvSetJSON");
    }
  }

  memoryStore.set(key, raw);
}

/**
 * STRICT read:
 * - If Upstash is configured, ONLY read from Upstash.
 * - If Upstash fails, throw (do NOT silently fall back).
 * - If Upstash is not configured, fall back to memory.
 */
export async function kvGetJSONStrict<T = Json>(key: string): Promise<T | null> {
  if (!key) return null;

  if (!redis) {
    const raw = memoryStore.get(key) ?? null;
    return safeParse<T>(raw);
  }

  if (!isRedisAllowedNow()) {
    throw new Error("Upstash temporarily unavailable (cooldown).");
  }

  try {
    const raw = (await redis.get<string>(key)) ?? null;
    return safeParse<T>(raw);
  } catch (err) {
    markRedisFailed(err, "kvGetJSONStrict");
    throw new Error("Upstash read failed.");
  }
}

/**
 * STRICT write:
 * - If Upstash is configured, ONLY write to Upstash.
 * - If Upstash fails, throw (so callers can show error and retry).
 * - If Upstash is not configured, fall back to memory.
 */
export async function kvSetJSONStrict(key: string, value: Json): Promise<void> {
  if (!key) return;

  const raw = safeStringify(value);

  if (!redis) {
    memoryStore.set(key, raw);
    return;
  }

  if (!isRedisAllowedNow()) {
    throw new Error("Upstash temporarily unavailable (cooldown).");
  }

  try {
    await redis.set(key, raw);
  } catch (err) {
    markRedisFailed(err, "kvSetJSONStrict");
    throw new Error("Upstash write failed.");
  }
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

  if (isRedisAllowedNow()) {
    try {
      const raw = (await redis!.get<string>(key)) ?? null;
      return { key, raw, parsed: safeParse(raw), source: "upstash" };
    } catch (err) {
      markRedisFailed(err, "kvDebugGetRaw");
    }
  }

  const raw = memoryStore.get(key) ?? null;
  return { key, raw, parsed: safeParse(raw), source: "memory" };
}
