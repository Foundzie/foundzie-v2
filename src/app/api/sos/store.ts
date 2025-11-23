// src/app/api/sos/store.ts
import "server-only";
import { kvGetJSON, kvSetJSON } from "@/lib/kv/redis";

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

// IMPORTANT: versioned key so we ignore any old corrupted data
const SOS_KEY = "foundzie:sos:v2";

async function loadAll(): Promise<SosEvent[]> {
  const items = (await kvGetJSON<SosEvent[]>(SOS_KEY)) ?? [];
  // newest first
  return items
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function saveAll(items: SosEvent[]): Promise<void> {
  await kvSetJSON(SOS_KEY, items);
}

export async function listEvents(): Promise<SosEvent[]> {
  return loadAll();
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

  const current = await loadAll();
  const next = [event, ...current];

  await saveAll(next);
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
  const current = await loadAll();
  const idx = current.findIndex((e) => e.id === id);
  if (idx === -1) return null;

  const event = current[idx];

  const updated: SosEvent = {
    ...event,
    status: patch.status ?? event.status,
    actions: [...(event.actions ?? [])],
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

  const next = [...current];
  next[idx] = updated;

  await saveAll(next);
  return updated;
}
