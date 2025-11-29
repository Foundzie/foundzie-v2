// src/app/api/voice/store.ts
import "server-only";
import { kvGetJSON, kvSetJSON } from "@/lib/kv/redis";

export type VoiceStatus = "none" | "requested" | "active" | "ended" | "failed";

export interface VoiceSession {
  id: string;
  roomId: string;
  userId: string | null;
  status: VoiceStatus;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  lastError?: string | null;
}

const VOICE_SESSION_PREFIX = "foundzie:voice:session:v1:";

function keyForRoom(roomId: string): string {
  return `${VOICE_SESSION_PREFIX}${roomId}`;
}

export async function getVoiceSessionForRoom(
  roomId: string
): Promise<VoiceSession | null> {
  const key = keyForRoom(roomId);
  const session = await kvGetJSON<VoiceSession>(key);
  return session ?? null;
}

export async function upsertVoiceSession(params: {
  roomId: string;
  userId?: string | null;
  status?: VoiceStatus;
  lastError?: string | null;
}): Promise<VoiceSession> {
  const roomId = params.roomId.trim();
  const existing = await getVoiceSessionForRoom(roomId);
  const now = new Date().toISOString();

  if (!existing) {
    const session: VoiceSession = {
      id: `voice-${Date.now().toString(16)}`,
      roomId,
      userId: params.userId ?? null,
      status: params.status ?? "requested",
      createdAt: now,
      updatedAt: now,
      lastError: params.lastError ?? null,
    };
    await kvSetJSON(keyForRoom(roomId), session);
    return session;
  }

  const updated: VoiceSession = {
    ...existing,
    userId: params.userId ?? existing.userId,
    status: params.status ?? existing.status,
    lastError: params.lastError ?? existing.lastError,
    updatedAt: now,
  };

  await kvSetJSON(keyForRoom(roomId), updated);
  return updated;
}
