// src/app/api/chat/store.ts

import type { ChatMessage } from "@/app/data/chat";
import { Redis } from "@upstash/redis";

/* ------------------------------------------------------------------ */
/*  Redis client (if env is configured)                               */
/* ------------------------------------------------------------------ */

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis =
  redisUrl && redisToken
    ? new Redis({
        url: redisUrl,
        token: redisToken,
      })
    : null;

let redisHealthy = !!redis;

function markRedisFailed(err: unknown, where: string) {
  console.error(`[chat.store] Redis error in ${where}:`, err);
  redisHealthy = false;
}

type RoomId = string;

/* ------------------------------------------------------------------ */
/*  In-memory fallback (dev / Redis issues)                           */
/* ------------------------------------------------------------------ */

const memoryStore: Record<RoomId, ChatMessage[]> = {};

function makeId() {
  return `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sortByTime(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

/* ------------------------------------------------------------------ */
/*  Dedupe helpers                                                    */
/* ------------------------------------------------------------------ */

// Short dedupe window catches double POSTs / retries
const DEDUPE_WINDOW_MS = 12_000;

// Some greetings can happen twice (chat + voice). Treat them as "same" for longer.
const GREETING_WINDOW_MS = 60_000;

// Normalize text so tiny whitespace differences don’t bypass dedupe
function normText(s: string) {
  return (s || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function isGreetingLike(text: string) {
  const t = normText(text);
  if (!t) return false;
  // Keep this list tight and obvious. Add more later if needed.
  return (
    t.includes("hey! this is foundzie") ||
    t.includes("how can i help you right now") ||
    t === "hey there! how can i assist you today?" ||
    t.startsWith("hey there! how can i assist you")
  );
}

function parseMaybeMessage(raw: any): ChatMessage | null {
  if (!raw) return null;

  let msg: any = raw;

  if (typeof raw === "string") {
    if (raw === "[object Object]") return null;
    try {
      msg = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (msg && typeof msg === "object" && typeof msg.createdAt === "string") {
    return msg as ChatMessage;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Public types                                                      */
/* ------------------------------------------------------------------ */

export type ChatRoomSummary = {
  id: string;
  lastMessage?: ChatMessage;
  lastAt?: string;
  lastSender?: "user" | "concierge";
};

export type NewMessageInput = {
  sender: "user" | "concierge";
  text: string;
  attachmentName: string | null;
  attachmentKind: "image" | "file" | null;
};

const roomKey = (roomId: RoomId) => `chat:room:${roomId}`;

/* ------------------------------------------------------------------ */
/*  listMessages(roomId)                                              */
/* ------------------------------------------------------------------ */

export async function listMessages(roomId: RoomId): Promise<ChatMessage[]> {
  if (!roomId) return [];

  if (redis && redisHealthy) {
    try {
      const key = roomKey(roomId);
      const raw = ((await redis.lrange(key, 0, -1)) as any[]) ?? [];

      const parsed: ChatMessage[] = [];
      for (const item of raw) {
        const msg = parseMaybeMessage(item);
        if (msg) parsed.push(msg);
      }

      return sortByTime(parsed);
    } catch (err) {
      markRedisFailed(err, "listMessages");
    }
  }

  const list = memoryStore[roomId] ?? [];
  return sortByTime(list);
}

/* ------------------------------------------------------------------ */
/*  addMessage(roomId, input)  (NOW WITH DEDUPE)                      */
/* ------------------------------------------------------------------ */

export async function addMessage(roomId: RoomId, input: NewMessageInput): Promise<ChatMessage> {
  if (!roomId) throw new Error("addMessage called without roomId");

  const now = Date.now();
  const cleanText = (input.text || "").trim();

  // Build the message we *would* write
  const message: ChatMessage = {
    id: makeId(),
    createdAt: new Date(now).toISOString(),
    sender: input.sender,
    text: cleanText,
    attachmentName: input.attachmentName,
    attachmentKind: input.attachmentKind,
  };

  const wantNorm = normText(message.text);
  const greeting = message.sender === "concierge" && isGreetingLike(message.text);
  const windowMs = greeting ? GREETING_WINDOW_MS : DEDUPE_WINDOW_MS;

  // --- Redis mode (only if still healthy) ---
  if (redis && redisHealthy) {
    try {
      const key = roomKey(roomId);

      // Peek last message and dedupe if same sender+text within window
      const rawLast = (await redis.lindex(key, -1)) as any;
      const last = parseMaybeMessage(rawLast);

      if (last) {
        const lastTime = Date.parse(last.createdAt || "");
        const within = Number.isFinite(lastTime) && now - lastTime <= windowMs;

        const sameSender = last.sender === message.sender;
        const sameText = normText(last.text || "") === wantNorm;
        const sameAttach =
          (last.attachmentName || null) === (message.attachmentName || null) &&
          (last.attachmentKind || null) === (message.attachmentKind || null);

        if (within && sameSender && sameText && sameAttach) {
          // Return existing instead of storing duplicate
          return last;
        }
      }

      await redis.rpush(key, JSON.stringify(message));
      return message;
    } catch (err) {
      markRedisFailed(err, "addMessage");
    }
  }

  // --- In-memory fallback ---
  if (!memoryStore[roomId]) memoryStore[roomId] = [];

  const list = memoryStore[roomId];
  const last = list.length ? list[list.length - 1] : null;

  if (last) {
    const lastTime = Date.parse(last.createdAt || "");
    const within = Number.isFinite(lastTime) && now - lastTime <= windowMs;

    const sameSender = last.sender === message.sender;
    const sameText = normText(last.text || "") === wantNorm;
    const sameAttach =
      (last.attachmentName || null) === (message.attachmentName || null) &&
      (last.attachmentKind || null) === (message.attachmentKind || null);

    if (within && sameSender && sameText && sameAttach) {
      return last;
    }
  }

  list.push(message);
  return message;
}

/* ------------------------------------------------------------------ */
/*  resetMessages(roomId?)                                            */
/* ------------------------------------------------------------------ */

export async function resetMessages(roomId?: RoomId): Promise<void> {
  if (redis && redisHealthy) {
    try {
      if (roomId) {
        await redis.del(roomKey(roomId));
      } else {
        const keys = ((await redis.keys("chat:room:*")) as string[] | null) ?? [];
        if (keys.length) await redis.del(...keys);
      }
      return;
    } catch (err) {
      markRedisFailed(err, "resetMessages");
    }
  }

  if (roomId) delete memoryStore[roomId];
  else for (const k of Object.keys(memoryStore)) delete memoryStore[k];
}

/* ------------------------------------------------------------------ */
/*  listRooms() – for admin inbox                                     */
/* ------------------------------------------------------------------ */

export async function listRooms(): Promise<ChatRoomSummary[]> {
  if (redis && redisHealthy) {
    try {
      const keys = ((await redis.keys("chat:room:*")) as string[] | null) ?? [];
      const rooms: ChatRoomSummary[] = [];

      for (const key of keys) {
        const roomId = key.replace("chat:room:", "");
        const rawLast = (await redis.lindex(key, -1)) as any;
        const lastMessage = parseMaybeMessage(rawLast) || undefined;

        rooms.push({
          id: roomId,
          lastMessage,
          lastAt: lastMessage?.createdAt,
          lastSender: lastMessage?.sender,
        });
      }

      rooms.sort((a, b) => {
        const aTime = a.lastAt ? Date.parse(a.lastAt) : 0;
        const bTime = b.lastAt ? Date.parse(b.lastAt) : 0;
        return bTime - aTime;
      });

      return rooms;
    } catch (err) {
      markRedisFailed(err, "listRooms");
    }
  }

  const rooms: ChatRoomSummary[] = Object.entries(memoryStore).map(([roomId, msgs]) => {
    const sorted = sortByTime(msgs);
    const last = sorted[sorted.length - 1];
    return {
      id: roomId,
      lastMessage: last,
      lastAt: last?.createdAt,
      lastSender: last?.sender,
    };
  });

  rooms.sort((a, b) => {
    const aTime = a.lastAt ? Date.parse(a.lastAt) : 0;
    const bTime = b.lastAt ? Date.parse(b.lastAt) : 0;
    return bTime - aTime;
  });

  return rooms;
}
