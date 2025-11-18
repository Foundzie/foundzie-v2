// src/app/api/calls/store.ts

// Direction for future: we can add "inbound" later
export type CallDirection = "outbound";

export interface CallLog {
  id: string;            // callId, e.g. "debug-call-123..."
  createdAt: string;     // ISO timestamp
  userId: string | null;
  userName: string | null;
  phone: string;
  note: string;
  direction: CallDirection;
}

// Keep in-memory list for now (same idea as your user store)
let logs: CallLog[] = [];

/**
 * Add a new call log entry (first position).
 * We keep only the latest 100 entries to avoid unbounded growth.
 */
export async function addCallLog(entry: Omit<CallLog, "createdAt">): Promise<CallLog> {
  const log: CallLog = {
    ...entry,
    createdAt: new Date().toISOString(),
  };

  logs.unshift(log);
  if (logs.length > 100) {
    logs = logs.slice(0, 100);
  }

  return log;
}

/**
 * Return recent call logs (most recent first).
 */
export async function listCallLogs(limit = 50): Promise<CallLog[]> {
  return logs.slice(0, limit);
}
