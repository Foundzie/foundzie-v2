// src/lib/kv/redis.ts
import "server-only";

type Json = any;

declare global {
  // eslint-disable-next-line no-var
  var __foundzieMemoryKv: Map<string, string> | undefined;
}

// Shared in-memory store (survives across modules in the same process)
const memoryStore: Map<string, string> =
  globalThis.__foundzieMemoryKv ?? new Map<string, string>();

globalThis.__foundzieMemoryKv = memoryStore;

/**
 * Read a JSON value from our KV store.
 */
export async function kvGetJSON<T = Json>(key: string): Promise<T | null> {
  const raw = memoryStore.get(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error("[kvGetJSON] Failed to parse JSON in memory for key:", key, err);
    // Auto-heal: delete corrupted value so the next write is clean
    memoryStore.delete(key);
    return null;
  }
}

/**
 * Write a JSON value to our KV store.
 */
export async function kvSetJSON(key: string, value: Json): Promise<void> {
  const raw = JSON.stringify(value ?? null);
  memoryStore.set(key, raw);
}

/**
 * Optional debug helper for /api/dev/seed.
 */
export async function kvDebugGetRaw(key: string): Promise<{
  key: string;
  raw: string | null;
  parsed: any | null;
}> {
  const raw = memoryStore.get(key) ?? null;
  let parsed: any = null;

  if (raw !== null) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  }

  return { key, raw, parsed };
}
