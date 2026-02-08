// src/app/api/diag/route.ts
import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { kvGetJSON, kvSetJSON } from "@/lib/kv/redis";
import { getHealthSnapshot } from "@/app/api/health/store";

export const dynamic = "force-dynamic";

function bearerFrom(req: NextRequest): string {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || "";
}

function isAuthorized(req: NextRequest): { ok: boolean; reason?: string } {
  const token = (process.env.ADMIN_TOKEN || "").trim();

  // In production, token must exist and must match.
  if (process.env.NODE_ENV === "production") {
    if (!token) return { ok: false, reason: "ADMIN_TOKEN is not configured" };
    const provided = bearerFrom(req);
    if (!provided) return { ok: false, reason: "Missing Authorization bearer token" };
    if (provided !== token) return { ok: false, reason: "Invalid token" };
    return { ok: true };
  }

  // In dev, if token isn't set, allow (but warn).
  if (!token) return { ok: true, reason: "DEV_MODE_NO_TOKEN" };

  const provided = bearerFrom(req);
  if (!provided) return { ok: false, reason: "Missing Authorization bearer token" };
  if (provided !== token) return { ok: false, reason: "Invalid token" };
  return { ok: true };
}

function present(v?: string | null) {
  const s = (v || "").trim();
  return s.length > 0;
}

async function kvPing(): Promise<{
  ok: boolean;
  mode: "upstash" | "memory";
  note?: string;
}> {
  const hasUpstash =
    present(process.env.UPSTASH_REDIS_REST_URL) && present(process.env.UPSTASH_REDIS_REST_TOKEN);

  // This ping uses your kv wrapper.
  // If Upstash is configured but temporarily failing, your wrapper may fallback to memory.
  // So we report both: "configured" and "write/read worked".
  const key = "foundzie:diag:ping:v1";
  const val = { at: new Date().toISOString(), nonce: Math.random().toString(16).slice(2) };

  try {
    await kvSetJSON(key, val);
    const got = await kvGetJSON<any>(key);

    const ok = !!got && got?.nonce === val.nonce;
    return {
      ok,
      mode: hasUpstash ? "upstash" : "memory",
      note: ok ? "KV read/write ok" : "KV ping mismatch (possible fallback or failure)",
    };
  } catch (e: any) {
    return {
      ok: false,
      mode: hasUpstash ? "upstash" : "memory",
      note: typeof e?.message === "string" ? e.message : String(e),
    };
  }
}

export async function GET(req: NextRequest) {
  const auth = isAuthorized(req);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: "forbidden", reason: auth.reason || "unauthorized" },
      { status: 403 }
    );
  }

  const build = {
    nodeEnv: process.env.NODE_ENV || "unknown",
    // safe public build markers you already use
    version: process.env.NEXT_PUBLIC_FOUNDZIE_VERSION || "unknown",
    milestone: process.env.NEXT_PUBLIC_FOUNDZIE_MILESTONE || "unknown",
    label: process.env.NEXT_PUBLIC_FOUNDZIE_BUILD_LABEL || "unknown",
    builtAt: process.env.NEXT_PUBLIC_FOUNDZIE_BUILT_AT || null,
    now: new Date().toISOString(),
    devAuthNote: auth.reason === "DEV_MODE_NO_TOKEN" ? "ADMIN_TOKEN not set (dev allowed)" : null,
  };

  const envPresence = {
    // Presence only. Never show values.
    hasAdminToken: present(process.env.ADMIN_TOKEN),

    hasOpenAIKey: present(process.env.OPENAI_API_KEY),
    hasTwilioSid: present(process.env.TWILIO_ACCOUNT_SID),
    hasTwilioToken: present(process.env.TWILIO_AUTH_TOKEN),
    hasTwilioNumber: present(process.env.TWILIO_PHONE_NUMBER),

    hasUpstashUrl: present(process.env.UPSTASH_REDIS_REST_URL),
    hasUpstashToken: present(process.env.UPSTASH_REDIS_REST_TOKEN),

    hasCronSecret: present(process.env.CRON_SECRET),
  };

  const kv = await kvPing();

  // Health snapshot is safe (it’s already what your admin uses).
  let health: any = null;
  let healthError: string | null = null;
  try {
    health = await getHealthSnapshot();
  } catch (e: any) {
    healthError = typeof e?.message === "string" ? e.message : String(e);
  }

  const foundzieTruthFiles = {
    systemMap: "/.foundzie/system-map.json",
    envContract: "/.foundzie/env-contract.json",
    featureRegistry: "/.foundzie/feature-registry.json",
    criticalPaths: "/.foundzie/critical-paths.json",
  };

  return NextResponse.json({
    ok: true,
    build,
    envPresence,
    kv,
    healthOk: healthError ? false : true,
    healthError,
    // include snapshot lightly (not huge / no secrets)
    healthSummary: health
      ? {
          agent: {
            totalRuns: health.agent?.totalRuns ?? 0,
            recentErrors: health.agent?.recentErrors ?? 0,
            lastErrorAt: health.agent?.lastErrorAt ?? null,
            openaiRequests: health.agent?.openaiRequests ?? 0,
            openaiTotalTokens: health.agent?.openaiTotalTokens ?? 0,
            openaiEstimatedCostUsd: health.agent?.openaiEstimatedCostUsd ?? 0,
          },
          calls: {
            totalCalls: health.calls?.totalCalls ?? 0,
            twilioErrors: health.calls?.twilioErrors ?? 0,
            twilioSkipped: health.calls?.twilioSkipped ?? 0,
            twilioTotalDurationSec: health.calls?.twilioTotalDurationSec ?? 0,
            twilioEstimatedCostUsd: health.calls?.twilioEstimatedCostUsd ?? 0,
          },
          places: {
            totalRequests: health.places?.totalRequests ?? 0,
            googleCallsToday: health.places?.googleCallsToday ?? 0,
            googleCallsDate: health.places?.googleCallsDate ?? null,
            osmFallbacks: health.places?.osmFallbacks ?? 0,
            localFallbacks: health.places?.localFallbacks ?? 0,
          },
          kv: health.kv ?? null,
          sponsored: health.sponsored ?? null,
        }
      : null,
    truthFiles: foundzieTruthFiles,
  });
}
