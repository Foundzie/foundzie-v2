// src/app/api/sos/store.ts

export type SosStatus = "new" | "in-progress" | "resolved";

export interface SosEvent {
  id: string;
  type: string;          // "police" | "medical" | "fire" | "general" | etc.
  message: string;
  status: SosStatus;
  createdAt: string;     // ISO string
  location?: string | null;
  source?: string | null;
  phone?: string | null;
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
  };

  events = [event, ...events];
  return event;
}

export async function updateEvent(
  id: string,
  patch: Partial<Pick<SosEvent, "status">>
): Promise<SosEvent | null> {
  const idx = events.findIndex((e) => e.id === id);
  if (idx === -1) return null;

  events[idx] = { ...events[idx], ...patch };
  return events[idx];
}
