import "server-only";
import { kvGetJSON, kvSetJSON } from "@/lib/kv/redis";

export interface TripPlan {
  id: string;          // internal trip id
  roomId: string;      // visitor / chat room
  messageId: string;   // chat message id that contained the plan
  text: string;        // full plan text (including TRIP_PLAN_BEGIN)
  createdAt: string;   // when the plan message was created
  savedAt: string;     // when user hit "Save plan"
  userId?: string | null;
}

// versioned key so we can change structure later if needed
const TRIPS_KEY = "foundzie:trips:v1";

async function loadAll(): Promise<TripPlan[]> {
  const items = (await kvGetJSON<TripPlan[]>(TRIPS_KEY)) ?? [];
  // newest saved first
  return items
    .slice()
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

async function saveAll(items: TripPlan[]): Promise<void> {
  await kvSetJSON(TRIPS_KEY, items);
}

export async function listTrips(): Promise<TripPlan[]> {
  return loadAll();
}

export async function listTripsForRoom(roomId: string): Promise<TripPlan[]> {
  const all = await loadAll();
  return all.filter((t) => t.roomId === roomId);
}

export async function addTrip(input: {
  roomId: string;
  messageId: string;
  text: string;
  createdAt?: string;
  userId?: string | null;
}): Promise<TripPlan> {
  const now = new Date().toISOString();
  const createdAt = input.createdAt || now;

  const current = await loadAll();

  // Idempotency: if we already saved this messageId, just return it
  const existing = current.find(
    (t) => t.messageId === input.messageId && t.roomId === input.roomId
  );
  if (existing) {
    return existing;
  }

  const trip: TripPlan = {
    id: crypto.randomUUID(),
    roomId: input.roomId,
    messageId: input.messageId,
    text: input.text,
    createdAt,
    savedAt: now,
    userId: input.userId ?? null,
  };

  const next = [trip, ...current];
  await saveAll(next);

  return trip;
}
