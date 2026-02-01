import "server-only";
import { kvGetJSON, kvSetJSON } from "@/lib/kv/redis";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type AgentEvent = { at: string; note?: string };

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

  openaiRequests: number;
  openaiPromptTokens: number;
  openaiCompletionTokens: number;
  openaiTotalTokens: number;
  openaiEstimatedCostUsd: number;
  lastOpenAiAt: string | null;
};

export type CallsHealth = {
  totalCalls: number;
  twilioErrors: number;
  twilioSkipped: number;
  lastErrorAt: string | null;
  lastSkipAt: string | null;
  recentIssues: CallIssue[];

  twilioTerminal: Record<string, number>;
  twilioTotalDurationSec: number;
  twilioEstimatedCostUsd: number;
  lastTwilioStatusAt: string | null;
};

export type PlacesHealth = {
  totalRequests: number;
  googleSuccess: number;
  osmFallbacks: number;
  localFallbacks: number;
  lastFallbackAt: string | null;
  recentFallbacks: PlacesFallbackEvent[];

  googleCallsToday: number;
  googleCallsDate: string;
};

export type KvHealth = {
  mode: "upstash" | "memory" | "unknown";
  lastCheckedAt: string | null;
};

export type HealthSnapshot = {
  agent: AgentHealth;
  calls: CallsHealth;
  places: PlacesHealth;
  kv: KvHealth;
};

/* ------------------------------------------------------------------ */

const HEALTH_KEY = "foundzie:health:v2";
const MAX_EVENTS = 20;

function defaultSnapshot(): HealthSnapshot {
  const today = new Date().toISOString().slice(0, 10);
  return {
    agent: {
      totalRuns: 0,
      recentErrors: 0,
      lastErrorAt: null,
      recentEvents: [],

      openaiRequests: 0,
      openaiPromptTokens: 0,
      openaiCompletionTokens: 0,
      openaiTotalTokens: 0,
      openaiEstimatedCostUsd: 0,
      lastOpenAiAt: null,
    },
    calls: {
      totalCalls: 0,
      twilioErrors: 0,
      twilioSkipped: 0,
      lastErrorAt: null,
      lastSkipAt: null,
      recentIssues: [],

      twilioTerminal: {},
      twilioTotalDurationSec: 0,
      twilioEstimatedCostUsd: 0,
      lastTwilioStatusAt: null,
    },
    places: {
      totalRequests: 0,
      googleSuccess: 0,
      osmFallbacks: 0,
      localFallbacks: 0,
      lastFallbackAt: null,
      recentFallbacks: [],

      googleCallsToday: 0,
      googleCallsDate: today,
    },
    kv: {
      mode: "unknown",
      lastCheckedAt: null,
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

  const base = defaultSnapshot();

  return {
    ...base,
    ...fromKv,
    agent: { ...base.agent, ...(fromKv as any).agent },
    calls: { ...base.calls, ...(fromKv as any).calls },
    places: { ...base.places, ...(fromKv as any).places },
    kv: { ...base.kv, ...(fromKv as any).kv },
  };
}

async function save(snapshot: HealthSnapshot): Promise<void> {
  await kvSetJSON(HEALTH_KEY, snapshot);
}

/* ------------------------------------------------------------------ */
/*  Public helpers                                                     */
/* ------------------------------------------------------------------ */

export async function getHealthSnapshot(): Promise<HealthSnapshot> {
  const snap = await load();
  try {
    const url = (process.env.UPSTASH_REDIS_REST_URL || "").trim();
    const token = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
    snap.kv.mode = url && token ? "upstash" : "memory";
    snap.kv.lastCheckedAt = new Date().toISOString();
    await save(snap);
  } catch {
    // ignore
  }
  return snap;
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

    snap.agent.recentEvents = pushBounded(snap.agent.recentEvents, { at: now, note });
  }

  await save(snap);
}

export async function recordAgentRun(input?: { hadError?: boolean; note?: string }) {
  const hadError = input?.hadError === true;
  await recordAgentCall(!hadError, input?.note);
}

export async function recordOpenAiUsage(input: {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}) {
  const snap = await load();
  const now = new Date().toISOString();

  const p = Number(input.promptTokens || 0);
  const c = Number(input.completionTokens || 0);
  const t = Number(input.totalTokens || p + c);

  snap.agent.openaiRequests += 1;
  snap.agent.openaiPromptTokens += p;
  snap.agent.openaiCompletionTokens += c;
  snap.agent.openaiTotalTokens += t;
  snap.agent.lastOpenAiAt = now;

  const inRate = Number(process.env.FOUNDZIE_OPENAI_COST_PER_1K_INPUT_TOKENS_USD || "0");
  const outRate = Number(process.env.FOUNDZIE_OPENAI_COST_PER_1K_OUTPUT_TOKENS_USD || "0");

  if (Number.isFinite(inRate) && Number.isFinite(outRate) && (inRate > 0 || outRate > 0)) {
    const est = (p / 1000) * inRate + (c / 1000) * outRate;
    snap.agent.openaiEstimatedCostUsd += est;
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
      note: "Call skipped (env/config not set)",
    });
  }

  await save(snap);
}

export async function recordTwilioStatusCallback(input: {
  status: string;
  durationSec?: number;
  priceUsd?: number;
  errorCode?: string | number | null;
}) {
  const snap = await load();
  const now = new Date().toISOString();

  const status = String(input.status || "").toLowerCase();
  if (status) {
    snap.calls.twilioTerminal[status] = (snap.calls.twilioTerminal[status] || 0) + 1;
  }

  const dur = Number(input.durationSec || 0);
  if (Number.isFinite(dur) && dur > 0) {
    snap.calls.twilioTotalDurationSec += dur;
  }

  const price = Number(input.priceUsd || 0);
  if (Number.isFinite(price) && price !== 0) {
    snap.calls.twilioEstimatedCostUsd += Math.abs(price);
  }

  snap.calls.lastTwilioStatusAt = now;

  if (status === "failed" && input.errorCode) {
    snap.calls.twilioErrors += 1;
    snap.calls.lastErrorAt = now;
    snap.calls.recentIssues = pushBounded(snap.calls.recentIssues, {
      at: now,
      kind: "error",
      note: `Twilio failed (code ${input.errorCode})`,
    });
  }

  await save(snap);
}

export async function recordPlacesRequest(source?: "google" | "osm" | "local") {
  const snap = await load();
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  if (snap.places.googleCallsDate !== today) {
    snap.places.googleCallsDate = today;
    snap.places.googleCallsToday = 0;
  }

  snap.places.totalRequests += 1;

  if (!source) {
    await save(snap);
    return;
  }

  if (source === "google") {
    snap.places.googleSuccess += 1;
    snap.places.googleCallsToday += 1;
    await save(snap);
    return;
  }

  await save(snap);
  await recordPlacesFallback(source, `Fallback to ${source.toUpperCase()}`);
}

export async function recordPlacesFallback(kind: "osm" | "local", note?: string) {
  const snap = await load();
  const now = new Date().toISOString();

  if (kind === "osm") snap.places.osmFallbacks += 1;
  if (kind === "local") snap.places.localFallbacks += 1;

  snap.places.lastFallbackAt = now;
  snap.places.recentFallbacks = pushBounded(snap.places.recentFallbacks, {
    at: now,
    kind,
    note: note || `Fallback to ${kind}`,
  });

  await save(snap);
}

export async function recordPlacesSource(source: "google" | "osm" | "local") {
  await recordPlacesRequest(source);
}

/* ------------------------------------------------------------------ */
/*  ✅ M21: Sponsored push metric hook                                 */
/* ------------------------------------------------------------------ */

export async function recordSponsoredPush(input: { campaignId: string; note?: string }) {
  const snap = await load();
  const now = new Date().toISOString();

  // We keep it lightweight: record as an agent event so it shows in health recents.
  snap.agent.recentEvents = pushBounded(snap.agent.recentEvents, {
    at: now,
    note: `[sponsored_push] campaign=${input.campaignId}${input.note ? ` | ${input.note}` : ""}`,
  });

  await save(snap);
}
