// src/lib/kv/redis.ts
//
// Tiny Redis helper for Node runtime routes.
// Uses REDIS_URL (e.g. from Upstash / any hosted Redis).
//
// If REDIS_URL is missing or Redis client fails, we fall back
// to in-memory mode (your app will still work in dev).

import "server-only";
import type { Redis as IORedisClient } from "ioredis";

let redisClient: IORedisClient | null = null;

// We lazy-init so that build doesn't crash if ioredis isn't installed
// or REDIS_URL is missing.
export function getRedis(): IORedisClient | null {
  if (redisClient) return redisClient;

  const url = process.env.REDIS_URL;
  if (!url) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[kv/redis] REDIS_URL not set — using in-memory SOS store.");
    }
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Redis = require("ioredis") as typeof import("ioredis");
    redisClient = new Redis.default(url);
    console.log("[kv/redis] Connected to Redis");
    return redisClient;
  } catch (err) {
    console.error("[kv/redis] Failed to init Redis client, falling back:", err);
    return null;
  }
}
