// src/app/api/health/store.ts
import "server-only";
import { kvGetJSON, kvSetJSON } from "@/lib/kv/redis";

export type AgentHealth = {
  calls: number;
  errors: number;
  lastErrorAt: string | null;
};

export type CallsHealth = {
  outbound: number;
  errors: number;
  lastErrorAt: string | null;
  lastSkipAt: string | null;
};

export type PlacesHealth = {
  totalRequests: number;
  googleSuccess: number;
  osmFallbacks: number;
  localFallbacks: number;
  lastFallbackAt: string | null;
};

export type HealthSnapshot = {
  agent: AgentHealth;
  calls: CallsHealth;
  places: PlacesHealth;
};

const HEALTH_KEY = "foundzie:health:v1";

function defaultSnapshot(): HealthSnapshot {
  return {
    agent: {
      calls: 0,
      errors: 0,
      lastErrorAt: null,
    },
    calls: {
      outbound: 0,
      errors: 0,
      lastErrorAt: null,
      lastSkipAt: null,
    },
    places: {
      totalRequests: 0,
      googleSuccess: 0,
      osmFallbacks: 0,
      localFallbacks: 0,
      lastFallbackAt: null,
    },
  };
}

async function load(): Promise<HealthSnapshot> {
  const fromKv = (await kvGetJSON<HealthSnapshot>(HEALTH_KEY)) ?? null;
  if (!fromKv) return defaultSnapshot();

  // simple defensive merge in case we add fields later
  return {
    ...defaultSnapshot(),
    ...fromKv,
    agent: { ...defaultSnapshot().agent, ...(fromKv as any).agent },
    calls: { ...defaultSnapshot().calls, ...(fromKv as any).calls },
    places: { ...defaultSnapshot().places, ...(fromKv as any).places },
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

export async function recordAgentCall(ok: boolean, _error?: unknown) {
  const snap = await load();
  snap.agent.calls += 1;
  if (!ok) {
    snap.agent.errors += 1;
    snap.agent.lastErrorAt = new Date().toISOString();
  }
  await save(snap);
}

export async function recordOutboundCall(opts: {
  hadError: boolean;
  twilioStatus: "started" | "skipped" | null;
}) {
  const snap = await load();
  snap.calls.outbound += 1;

  const now = new Date().toISOString();

  if (opts.hadError) {
    snap.calls.errors += 1;
    snap.calls.lastErrorAt = now;
  } else if (opts.twilioStatus === "skipped") {
    // env missing or other non-fatal issue
    snap.calls.errors += 1;
    snap.calls.lastSkipAt = now;
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
  } else if (source === "local") {
    snap.places.localFallbacks += 1;
    snap.places.lastFallbackAt = now;
  }

  await save(snap);
}
