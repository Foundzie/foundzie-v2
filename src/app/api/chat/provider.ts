// src/app/api/chat/provider.ts

import type { ChatMessage, ChatSender } from "@/app/data/chat";
import { initialMessages } from "@/app/data/chat";
import { kvGetJSON, kvSetJSON } from "@/lib/kv/redis";

export type NewMessageInput = {
  sender: ChatSender;
  text: string;
  attachmentName?: string | null;
  attachmentKind?: "image" | "file" | null;
};

export type ChatRoomSummary = {
  id: string; // roomId
  lastMessage?: ChatMessage;
  lastAt?: string;
  lastSender?: ChatSender;
};

const DEFAULT_ROOM_ID = "demo-visitor-1";

// Versioned KV keys
const CHAT_ROOM_KEY_PREFIX = "foundzie:chat:room:v1:";
const CHAT_ROOMS_INDEX_KEY = "foundzie:chat:rooms:v1";

function roomKey(roomId: string) {
  return `${CHAT_ROOM_KEY_PREFIX}${roomId}`;
}

/**
 * Ensure the roomId is present in the rooms index in KV.
 */
async function ensureRoomInIndex(roomId: string): Promise<void> {
  const index =
    (await kvGetJSON<string[]>(CHAT_ROOMS_INDEX_KEY)) ?? [];

  if (!Array.isArray(index)) {
    await kvSetJSON(CHAT_ROOMS_INDEX_KEY, [roomId]);
    return;
  }

  if (!index.includes(roomId)) {
    index.push(roomId);
    await kvSetJSON(CHAT_ROOMS_INDEX_KEY, index);
  }
}

/**
 * Load a room's messages from KV.
 * If the room is empty / missing, seed it with initialMessages.
 */
async function loadRoom(roomId: string = DEFAULT_ROOM_ID): Promise<ChatMessage[]> {
  const key = roomKey(roomId);

  const existing =
    (await kvGetJSON<ChatMessage[]>(key)) ?? null;

  if (Array.isArray(existing) && existing.length > 0) {
    return existing;
  }

  // Seed new room with initial messages
  const seeded = initialMessages.map((m) => ({ ...m }));
  await kvSetJSON(key, seeded);
  await ensureRoomInIndex(roomId);

  return seeded;
}

/**
 * Save a room's messages back to KV and ensure it's indexed.
 */
async function saveRoom(
  roomId: string,
  messages: ChatMessage[]
): Promise<void> {
  await kvSetJSON(roomKey(roomId), messages);
  await ensureRoomInIndex(roomId);
}

// ----------------- Public provider API -----------------

export const chatProvider = {
  async list(roomId: string): Promise<ChatMessage[]> {
    return loadRoom(roomId);
  },

  async add(roomId: string, input: NewMessageInput): Promise<ChatMessage> {
    const messages = await loadRoom(roomId || DEFAULT_ROOM_ID);

    const msg: ChatMessage = {
      id: String(Date.now()) + Math.random().toString(16).slice(2),
      sender: input.sender,
      text: input.text,
      createdAt: new Date().toISOString(),
      attachmentName: input.attachmentName ?? null,
      attachmentKind: input.attachmentKind ?? null,
    };

    messages.push(msg);
    await saveRoom(roomId || DEFAULT_ROOM_ID, messages);

    return msg;
  },

  async reset(roomId?: string): Promise<void> {
    if (roomId) {
      const seeded = initialMessages.map((m) => ({ ...m }));
      await kvSetJSON(roomKey(roomId), seeded);
      await ensureRoomInIndex(roomId);
      return;
    }

    // Global reset: reset default room and index to just the default.
    const seeded = initialMessages.map((m) => ({ ...m }));
    await kvSetJSON(roomKey(DEFAULT_ROOM_ID), seeded);
    await kvSetJSON(CHAT_ROOMS_INDEX_KEY, [DEFAULT_ROOM_ID]);
  },

  async listRooms(): Promise<ChatRoomSummary[]> {
    let index =
      (await kvGetJSON<string[]>(CHAT_ROOMS_INDEX_KEY)) ?? [];

    // If no rooms yet, ensure the default exists.
    if (!Array.isArray(index) || index.length === 0) {
      await loadRoom(DEFAULT_ROOM_ID);
      index = [DEFAULT_ROOM_ID];
      await kvSetJSON(CHAT_ROOMS_INDEX_KEY, index);
    }

    const summaries: ChatRoomSummary[] = [];

    for (const id of index) {
      const msgs = await loadRoom(id);
      const last = msgs[msgs.length - 1];

      summaries.push({
        id,
        lastMessage: last,
        lastAt: last?.createdAt,
        lastSender: last?.sender,
      });
    }

    return summaries;
  },
};
