// src/app/api/sos/store.ts
//
// SOS store with optional Redis backing.
// - If REDIS_URL + ioredis are available → data is stored in Redis.
// - Otherwise → falls back to in-memory array (what you had before).
//
// The public API (types + functions) is unchanged so all existing
// routes & UIs keep working.

import "server-only";
import { getRedis } from "@/lib/kv/redis";

export type SosStatus = "new" | "in-progress" | "resolved";

export interface SosAction {
  id: string;
  at: string; // ISO timestamp
  text: string;
  by?: string | null;
}

export interface SosEvent {
  id: string;
  type: string; // "police" | "medical" | "fire" | "general" | etc.
  message: string;
  status: SosStatus;
  createdAt: string; // ISO string
  location?: string | null;
  source?: string | null;
  phone?: string | null;

  // Link to admin user (if known)
  userId?: string | null;

  // Action log (admin notes)
  actions: SosAction[];
}

// Redis key namespace for SOS events
const SOS_LIST_KEY = "foundzie:sos:events:v1";

// In-memory fallback (dev / no Redis)
let memoryEvents: SosEvent[] = [];

// ---------- Helpers for Redis <-> SosEvent ----------

function sortNewestFirst(events: SosEvent[]): SosEvent[] {
  return events.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function parseEvent(raw: string): SosEvent | null {
  try {
    const obj = JSON.parse(raw) as SosEvent;
    if (!obj || typeof obj.id !== "string") return null;
    // ensure actions array exists
    obj.actions = Array.isArray(obj.actions) ? obj.actions : [];
    return obj;
  } catch {
    return null;
  }
}

async function readAllFromRedis(): Promise<SosEvent[]> {
  const client = getRedis();
  if (!client) return memoryEvents;

  const entries = await client.lrange(SOS_LIST_KEY, 0, -1);
  const parsed: SosEvent[] = [];
  for (const raw of entries) {
    const evt = parseEvent(raw);
    if (evt) parsed.push(evt);
  }
  return parsed;
}

async function writeAllToRedis(events: SosEvent[]): Promise<void> {
  const client = getRedis();
  if (!client) {
    memoryEvents = events;
    return;
  }

  const pipeline = client.multi();
  pipeline.del(SOS_LIST_KEY);
  if (events.length > 0) {
    // store newest first to match your existing behavior
    for (const e of events) {
      pipeline.lpush(SOS_LIST_KEY, JSON.stringify(e));
    }
  }
  await pipeline.exec();
}

// ---------- Public API (same signatures as before) ----------

// newest first
export async function listEvents(): Promise<SosEvent[]> {
  const client = getRedis();
  if (!client) {
    return sortNewestFirst(memoryEvents);
  }

  const events = await readAllFromRedis();
  return sortNewestFirst(events);
}

export async function addEvent(input: {
  message: string;
  type?: string;
  location?: string;
  source?: string;
  phone?: string;
  userId?: string;
}): Promise<SosEvent> {
  const event: SosEvent = {
    id: crypto.randomUUID(),
    message: input.message,
    type: input.type ?? "general",
    status: "new",
    createdAt: new Date().toISOString(),
    location: input.location ?? null,
    source: input.source ?? "mobile-sos",
    phone: input.phone ?? null,
    userId: input.userId ?? null,
    actions: [],
  };

  const client = getRedis();

  if (!client) {
    // in-memory only
    memoryEvents = [event, ...memoryEvents];
    return event;
  }

  // Redis: push as newest entry
  await client.lpush(SOS_LIST_KEY, JSON.stringify(event));
  return event;
}

type UpdatePatch = {
  status?: SosStatus;
  newActionText?: string;
  newActionBy?: string;
  userId?: string | null;
};

export async function updateEvent(
  id: string,
  patch: UpdatePatch
): Promise<SosEvent | null> {
  const client = getRedis();

  // -------- In-memory branch --------
  if (!client) {
    const idx = memoryEvents.findIndex((e) => e.id === id);
    if (idx === -1) return null;

    const current = memoryEvents[idx];

    const updated: SosEvent = {
      ...current,
      status: patch.status ?? current.status,
      actions: [...(current.actions ?? [])],
    };

    if (patch.userId !== undefined) {
      updated.userId = patch.userId;
    }

    if (patch.newActionText && patch.newActionText.trim()) {
      updated.actions.push({
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        text: patch.newActionText.trim(),
        by: patch.newActionBy ?? null,
      });
    }

    memoryEvents[idx] = updated;
    return updated;
  }

  // -------- Redis branch --------
  const all = await readAllFromRedis();
  const idx = all.findIndex((e) => e.id === id);
  if (idx === -1) return null;

  const current = all[idx];

  const updated: SosEvent = {
    ...current,
    status: patch.status ?? current.status,
    actions: [...(current.actions ?? [])],
  };

  if (patch.userId !== undefined) {
    updated.userId = patch.userId;
  }

  if (patch.newActionText && patch.newActionText.trim()) {
    updated.actions.push({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      text: patch.newActionText.trim(),
      by: patch.newActionBy ?? null,
    });
  }

  all[idx] = updated;
  await writeAllToRedis(all);

  return updated;
}
