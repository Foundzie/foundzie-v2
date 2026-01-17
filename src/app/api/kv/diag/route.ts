// src/app/api/kv/diag/route.ts
import "server-only";
import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { kvDebugGetRaw } from "@/lib/kv/redis";

export const dynamic = "force-dynamic";

function envInfo() {
  const url = (process.env.UPSTASH_REDIS_REST_URL || "").trim();
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
  return {
    hasUrl: Boolean(url),
    hasToken: Boolean(token),
    urlPrefix: url ? url.slice(0, 25) + "..." : "",
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const roomId = (searchParams.get("roomId") || "").trim();

  const env = envInfo();

  // 1) Direct Upstash ping (bypasses your fallback logic)
  let upstashOk = false;
  let upstashError: string | null = null;

  try {
    if (!env.hasUrl || !env.hasToken) {
      throw new Error("Missing Upstash env vars on this deployment.");
    }
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!.trim(),
      token: process.env.UPSTASH_REDIS_REST_TOKEN!.trim(),
    });

    // lightweight write/read
    const key = "foundzie:diag:ping:v1";
    const val = `ok-${Date.now()}`;
    await redis.set(key, val);
    const got = await redis.get<string>(key);
    upstashOk = got === val;
    if (!upstashOk) upstashError = `Ping mismatch (got=${String(got)})`;
  } catch (e: any) {
    upstashOk = false;
    upstashError = typeof e?.message === "string" ? e.message : String(e);
  }

  // 2) If roomId provided, show what your app KV returns for contacts key
  let contactsKeyDebug: any = null;
  if (roomId) {
    const contactsKey = `foundzie:contacts:${roomId}:v1`;
    contactsKeyDebug = await kvDebugGetRaw(contactsKey).catch((e: any) => ({
      error: typeof e?.message === "string" ? e.message : String(e),
    }));
  }

  return NextResponse.json({
    ok: true,
    env,
    upstashOk,
    upstashError,
    contactsKeyDebug,
  });
}
