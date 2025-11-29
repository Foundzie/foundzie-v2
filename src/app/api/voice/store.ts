// src/app/api/voice/store.ts
import "server-only";
import { kvGetJSON, kvSetJSON } from "@/lib/kv/redis";

export type VoiceStatus =
  | "requested"
  | "ringing"
  | "active"
  | "ended"
  | "failed";

export interface VoiceSession {
  id: string;
  roomId: string;
  userId: string | null;
  status: VoiceStatus;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  lastError?: string | null;
}

const VOICE_SESSIONS_KEY = "foundzie:voice-sessions:v1";

async function loadAll(): Promise<VoiceSession[]> {
  const items = (await kvGetJSON<VoiceSession[]>(VOICE_SESSIONS_KEY)) ?? [];
  // newest first
  return items
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function saveAll(items: VoiceSession[]): Promise<void> {
  await kvSetJSON(VOICE_SESSIONS_KEY, items);
}

function makeId() {
  return `session-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function normalizeStatus(status?: string | null): VoiceStatus {
  const s = (status || "").toLowerCase();
  if (s === "ringing" || s === "active" || s === "ended" || s === "failed") {
    return s;
  }
  return "requested";
}

// Create or update a session for a room
export async function createOrUpdateVoiceSession(params: {
  roomId: string;
  userId?: string | null;
  status?: string | null;
  lastError?: string | null;
}): Promise<VoiceSession> {
  const roomId = params.roomId.trim();
  const userId = params.userId?.trim() || null;
  const status = normalizeStatus(params.status);
  const lastError =
    typeof params.lastError === "string" ? params.lastError : null;

  if (!roomId) {
    throw new Error("roomId is required");
  }

  const all = await loadAll();
  const now = new Date().toISOString();

  const existingIndex = all.findIndex((s) => s.roomId === roomId);
  let session: VoiceSession;

  if (existingIndex >= 0) {
    const current = all[existingIndex];
    session = {
      ...current,
      status,
      userId: userId ?? current.userId,
      updatedAt: now,
      lastError: lastError ?? current.lastError ?? null,
    };
    all[existingIndex] = session;
  } else {
    session = {
      id: makeId(),
      roomId,
      userId,
      status,
      createdAt: now,
      updatedAt: now,
      lastError,
    };
    all.unshift(session);
  }

  // keep last 200 sessions max
  await saveAll(all.slice(0, 200));
  return session;
}

export async function getVoiceSessionForRoom(
  roomId: string
): Promise<VoiceSession | null> {
  const all = await loadAll();
  return all.find((s) => s.roomId === roomId) ?? null;
}

export async function updateVoiceSessionStatus(params: {
  roomId: string;
  status: VoiceStatus;
  lastError?: string | null;
}): Promise<VoiceSession | null> {
  const all = await loadAll();
  const idx = all.findIndex((s) => s.roomId === params.roomId.trim());
  if (idx < 0) return null;

  const now = new Date().toISOString();
  const lastError =
    typeof params.lastError === "string" ? params.lastError : null;

  const updated: VoiceSession = {
    ...all[idx],
    status: params.status,
    updatedAt: now,
    lastError: lastError ?? all[idx].lastError ?? null,
  };

  all[idx] = updated;
  await saveAll(all.slice(0, 200));
  return updated;
}

// Optional: list recent sessions for future admin page / debugging
export async function listVoiceSessions(limit = 50): Promise<VoiceSession[]> {
  const all = await loadAll();
  return all.slice(0, limit);
}
