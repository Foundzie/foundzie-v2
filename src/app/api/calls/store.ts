// src/app/api/calls/store.ts
import "server-only";
import { kvGetJSON, kvSetJSON } from "@/lib/kv/redis";

export type CallDirection = "outbound";

export interface CallLog {
  id: string;
  createdAt: string;
  userId: string | null;
  userName: string | null;
  phone: string;
  note: string;
  direction: CallDirection;
}

const CALLS_KEY = "foundzie:calls:v2";

async function loadAll(): Promise<CallLog[]> {
  const items = (await kvGetJSON<CallLog[]>(CALLS_KEY)) ?? [];
  return items.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function saveAll(items: CallLog[]): Promise<void> {
  await kvSetJSON(CALLS_KEY, items);
}

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

export async function listCallLogs(limit = 50): Promise<CallLog[]> {
  const items = await loadAll();
  return items.slice(0, limit);
}
