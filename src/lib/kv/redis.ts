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

// short cooldown on transient Upstash failures
let redisDisabledUntil = 0; // epoch ms

function isRedisAllowedNow() {
  return !!redis && Date.now() >= redisDisabledUntil;
}

function markRedisFailed(err: unknown, where: string) {
  console.error(`[kv.redis] Upstash error in ${where}:`, err);
  redisDisabledUntil = Date.now() + 15_000; // 15s backoff
}

/* ---------------- Helpers ---------------- */

function safeParseString<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Upstash may return either:
 * - a JSON string, or
 * - an already-parsed JSON value (object/array/number/etc).
 *
 * This normalizes both forms into a T (or null).
 */
function normalizeUpstashValue<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;

  // If it's already JSON (object/array/number/bool), accept it
  if (typeof value !== "string") {
    return value as T;
  }

  // If it's a string, try parsing as JSON; if parsing fails, treat as "not JSON"
  const parsed = safeParseString<T>(value);
  return parsed;
}

function safeStringify(value: any) {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return "null";
  }
}

/* ---------------- Public KV API ---------------- */

/**
 * Best-effort read: Upstash → memory fallback.
 */
export async function kvGetJSON<T = Json>(key: string): Promise<T | null> {
  if (!key) return null;

  if (isRedisAllowedNow()) {
    try {
      // IMPORTANT: do not assume a string; Upstash may return JSON directly.
      const v = await redis!.get(key);
      const normalized = normalizeUpstashValue<T>(v);
      return normalized;
    } catch (err) {
      markRedisFailed(err, "kvGetJSON");
    }
  }

  // memory fallback always stores strings
  const raw = memoryStore.get(key) ?? null;
  const parsed = safeParseString<T>(raw);
  if (raw && parsed === null) {
    console.error("[kvGetJSON] Failed to parse JSON in memory for key:", key);
    memoryStore.delete(key);
  }
  return parsed;
}

/**
 * Best-effort write: Upstash → memory fallback.
 *
 * We write JSON **as a string** for compatibility with memory fallback.
 * Reads can handle both string and native JSON (see normalizeUpstashValue).
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
 * If Upstash is configured, do NOT fallback to memory.
 */
export async function kvGetJSONStrict<T = Json>(key: string): Promise<T | null> {
  if (!key) return null;

  if (!redis) {
    const raw = memoryStore.get(key) ?? null;
    return safeParseString<T>(raw);
  }

  if (!isRedisAllowedNow()) {
    throw new Error("Upstash temporarily unavailable (cooldown).");
  }

  try {
    const v = await redis.get(key);
    return normalizeUpstashValue<T>(v);
  } catch (err) {
    markRedisFailed(err, "kvGetJSONStrict");
    throw new Error("Upstash read failed.");
  }
}

/**
 * STRICT write:
 * If Upstash is configured, do NOT fallback to memory.
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
 * Debug helper
 */
export async function kvDebugGetRaw(key: string): Promise<{
  key: string;
  raw: any | null;
  parsed: any | null;
  source: "upstash" | "memory";
}> {
  if (!key) return { key, raw: null, parsed: null, source: "memory" };

  if (isRedisAllowedNow()) {
    try {
      const v = await redis!.get(key);
      return { key, raw: v ?? null, parsed: normalizeUpstashValue(v), source: "upstash" };
    } catch (err) {
      markRedisFailed(err, "kvDebugGetRaw");
    }
  }

  const raw = memoryStore.get(key) ?? null;
  return { key, raw, parsed: safeParseString(raw), source: "memory" };
}
