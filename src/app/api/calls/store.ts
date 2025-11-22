import "server-only";
import { kvGetJSON, kvSetJSON } from "@/lib/kv/redis";

// Direction for future: we can add "inbound" later
export type CallDirection = "outbound";

export interface CallLog {
  id: string;        // callId, e.g. "debug-call-123..."
  createdAt: string; // ISO timestamp
  userId: string | null;
  userName: string | null;
  phone: string;
  note: string;
  direction: CallDirection;
}

// ⬇⬇ IMPORTANT: new versioned key so we ignore any old corrupted data
const CALLS_KEY = "foundzie:calls:v2";

// --- internal helpers -------------------------------------------------

async function loadAll(): Promise<CallLog[]> {
  const items = (await kvGetJSON<CallLog[]>(CALLS_KEY)) ?? [];
  const sorted = items.slice().sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
  return sorted;
}

async function saveAll(items: CallLog[]): Promise<void> {
  await kvSetJSON(CALLS_KEY, items);
}

// --- public API -------------------------------------------------------

/**
 * Add a new call log entry (first position).
 * We keep only the latest 100 entries to avoid unbounded growth.
 */
export async function addCallLog(
  entry: Omit<CallLog, "createdAt">
): Promise<CallLog> {
  const log: CallLog = {
    ...entry,
    createdAt: new Date().toISOString(),
  };

  const current = await loadAll();
  const next = [log, ...current].slice(0, 100);

  await saveAll(next);
  return log;
}

/**
 * Return recent call logs (most recent first).
 */
export async function listCallLogs(limit = 50): Promise<CallLog[]> {
  const items = await loadAll();
  return items.slice(0, limit);
}
