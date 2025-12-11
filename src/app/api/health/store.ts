// src/app/api/health/store.ts
import "server-only";
import { kvGetJSON, kvSetJSON } from "@/lib/kv/redis";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type AgentEvent = {
  at: string;
  note?: string;
};

export type CallIssue = {
  at: string;
  kind: "error" | "skipped";
  note?: string;
};

export type PlacesFallbackEvent = {
  at: string;
  kind: "osm" | "local";
  note?: string;
};

export type AgentHealth = {
  totalRuns: number;
  recentErrors: number;
  lastErrorAt: string | null;
  recentEvents: AgentEvent[];
};

export type CallsHealth = {
  totalCalls: number;
  twilioErrors: number;
  twilioSkipped: number;
  lastErrorAt: string | null;
  lastSkipAt: string | null;
  recentIssues: CallIssue[];
};

export type PlacesHealth = {
  totalRequests: number;
  googleSuccess: number;
  osmFallbacks: number;
  localFallbacks: number;
  lastFallbackAt: string | null;
  recentFallbacks: PlacesFallbackEvent[];
};

export type HealthSnapshot = {
  agent: AgentHealth;
  calls: CallsHealth;
  places: PlacesHealth;
};

/* ------------------------------------------------------------------ */

const HEALTH_KEY = "foundzie:health:v1";
const MAX_EVENTS = 20;

function defaultSnapshot(): HealthSnapshot {
  return {
    agent: {
      totalRuns: 0,
      recentErrors: 0,
      lastErrorAt: null,
      recentEvents: [],
    },
    calls: {
      totalCalls: 0,
      twilioErrors: 0,
      twilioSkipped: 0,
      lastErrorAt: null,
      lastSkipAt: null,
      recentIssues: [],
    },
    places: {
      totalRequests: 0,
      googleSuccess: 0,
      osmFallbacks: 0,
      localFallbacks: 0,
      lastFallbackAt: null,
      recentFallbacks: [],
    },
  };
}

function pushBounded<T>(arr: T[] | undefined, item: T, max = MAX_EVENTS): T[] {
  const base = Array.isArray(arr) ? arr : [];
  return [item, ...base].slice(0, max);
}

async function load(): Promise<HealthSnapshot> {
  const fromKv = (await kvGetJSON<HealthSnapshot>(HEALTH_KEY)) ?? null;
  if (!fromKv) return defaultSnapshot();

  // simple defensive merge in case we add fields later
  const base = defaultSnapshot();

  return {
    ...base,
    ...fromKv,
    agent: { ...base.agent, ...(fromKv as any).agent },
    calls: { ...base.calls, ...(fromKv as any).calls },
    places: { ...base.places, ...(fromKv as any).places },
  };
}

async function save(snapshot: HealthSnapshot): Promise<void> {
  await kvSetJSON(HEALTH_KEY, snapshot);
}

/* ------------------------------------------------------------------ */
/*  Public helpers                                                     */
/* ------------------------------------------------------------------ */

export async function getHealthSnapshot(): Promise<HealthSnapshot> {
  return load();
}

export async function recordAgentCall(ok: boolean, error?: unknown) {
  const snap = await load();
  snap.agent.totalRuns += 1;

  if (!ok) {
    const now = new Date().toISOString();
    snap.agent.recentErrors += 1;
    snap.agent.lastErrorAt = now;

    const note =
      typeof error === "string"
        ? error
        : error instanceof Error
        ? error.message
        : error
        ? String(error)
        : undefined;

    snap.agent.recentEvents = pushBounded(snap.agent.recentEvents, {
      at: now,
      note,
    });
  }

  await save(snap);
}

export async function recordOutboundCall(opts: {
  hadError: boolean;
  twilioStatus: "started" | "skipped" | null;
}) {
  const snap = await load();
  snap.calls.totalCalls += 1;

  const now = new Date().toISOString();

  if (opts.hadError) {
    snap.calls.twilioErrors += 1;
    snap.calls.lastErrorAt = now;
    snap.calls.recentIssues = pushBounded(snap.calls.recentIssues, {
      at: now,
      kind: "error",
      note: "Twilio error",
    });
  } else if (opts.twilioStatus === "skipped") {
    snap.calls.twilioSkipped += 1;
    snap.calls.lastSkipAt = now;
    snap.calls.recentIssues = pushBounded(snap.calls.recentIssues, {
      at: now,
      kind: "skipped",
      note: "Call skipped (env or config issue)",
    });
  }

  await save(snap);
}

export async function recordPlacesSource(
  source: "google" | "osm" | "local"
) {
  const snap = await load();
  snap.places.totalRequests += 1;

  const now = new Date().toISOString();

  if (source === "google") {
    snap.places.googleSuccess += 1;
  } else if (source === "osm") {
    snap.places.osmFallbacks += 1;
    snap.places.lastFallbackAt = now;
    snap.places.recentFallbacks = pushBounded(
      snap.places.recentFallbacks,
      { at: now, kind: "osm", note: "Fallback to OpenStreetMap" },
    );
  } else if (source === "local") {
    snap.places.localFallbacks += 1;
    snap.places.lastFallbackAt = now;
    snap.places.recentFallbacks = pushBounded(
      snap.places.recentFallbacks,
      { at: now, kind: "local", note: "Fallback to local sample data" },
    );
  }

  await save(snap);
}
