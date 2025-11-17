// src/app/api/sos/store.ts

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

// simple in-memory list (reset on server restart)
let events: SosEvent[] = [];

// newest first
export async function listEvents(): Promise<SosEvent[]> {
  return events.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
    actions: [], // start with empty action log
  };

  events = [event, ...events];
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
  const idx = events.findIndex((e) => e.id === id);
  if (idx === -1) return null;

  const current = events[idx];

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

  events[idx] = updated;
  return updated;
}
