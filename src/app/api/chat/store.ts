// src/app/api/chat/store.ts

import type { ChatMessage } from "@/app/data/chat";
import { Redis } from "@upstash/redis";

/* ------------------------------------------------------------------ */
/*  Redis client (if env is configured)                               */
/* ------------------------------------------------------------------ */

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

// If URL + TOKEN exist, we ATTEMPT Redis.
// If Redis throws even once, we mark it unhealthy and fall back to memory.
const redis =
  redisUrl && redisToken
    ? new Redis({
        url: redisUrl,
        token: redisToken,
      })
    : null;

// If this flips to false, we never touch Redis again in this process.
let redisHealthy = !!redis;

function markRedisFailed(err: unknown, where: string) {
  console.error(`[chat.store] Redis error in ${where}:`, err);
  redisHealthy = false;
}

type RoomId = string;

/* ------------------------------------------------------------------ */
/*  In-memory fallback (dev / Redis issues)                            */
/* ------------------------------------------------------------------ */

const memoryStore: Record<RoomId, ChatMessage[]> = {};

function makeId() {
  return `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sortByTime(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

/* ------------------------------------------------------------------ */
/*  Public types                                                       */
/* ------------------------------------------------------------------ */

export type ChatRoomSummary = {
  id: string; // roomId
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

export async function listMessages(
  roomId: RoomId
): Promise<ChatMessage[]> {
  if (!roomId) return [];

  // --- Redis mode (only if still healthy) ---
  if (redis && redisHealthy) {
    try {
      const key = roomKey(roomId);
      const raw = ((await redis.lrange(key, 0, -1)) as any[]) ?? [];

      const parsed: ChatMessage[] = [];

      for (const item of raw) {
        if (item == null) continue;

        let msg: any = item;

        if (typeof item === "string") {
          // OLD BAD DATA: we once pushed objects directly → "[object Object]"
          if (item === "[object Object]") {
            console.warn(
              "[chat.store] listMessages – skipping legacy '[object Object]' entry for",
              key
            );
            continue;
          }

          try {
            msg = JSON.parse(item);
          } catch (err) {
            console.error(
              "[chat.store] listMessages JSON.parse error for",
              key,
              "value:",
              item,
              err
            );
            // Skip just this one entry, do NOT kill Redis.
            continue;
          }
        }

        if (
          msg &&
          typeof msg === "object" &&
          typeof msg.createdAt === "string"
        ) {
          parsed.push(msg as ChatMessage);
        } else {
          console.warn(
            "[chat.store] listMessages – skipping non-object / malformed message:",
            msg
          );
        }
      }

      return sortByTime(parsed);
    } catch (err) {
      // Only real Redis / network failures should flip us to memory mode.
      markRedisFailed(err, "listMessages");
    }
  }

  // --- In-memory fallback ---
  const list = memoryStore[roomId] ?? [];
  return sortByTime(list);
}

/* ------------------------------------------------------------------ */
/*  addMessage(roomId, input)                                         */
/* ------------------------------------------------------------------ */

export async function addMessage(
  roomId: RoomId,
  input: NewMessageInput
): Promise<ChatMessage> {
  if (!roomId) {
    throw new Error("addMessage called without roomId");
  }

  const message: ChatMessage = {
    id: makeId(),
    createdAt: new Date().toISOString(),
    sender: input.sender,
    text: input.text,
    attachmentName: input.attachmentName,
    attachmentKind: input.attachmentKind,
  };

  // --- Redis mode (only if still healthy) ---
  if (redis && redisHealthy) {
    try {
      const key = roomKey(roomId);
      await redis.rpush(key, JSON.stringify(message));
      return message;
    } catch (err) {
      // If writing to Redis fails, mark unhealthy so we STOP reading from it too.
      markRedisFailed(err, "addMessage");
    }
  }

  // --- In-memory fallback ---
  if (!memoryStore[roomId]) {
    memoryStore[roomId] = [];
  }
  memoryStore[roomId].push(message);

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
        const keys =
          ((await redis.keys("chat:room:*")) as string[] | null) ?? [];
        if (keys.length) {
          await redis.del(...keys);
        }
      }
      return;
    } catch (err) {
      markRedisFailed(err, "resetMessages");
      // fall through to memory reset
    }
  }

  if (roomId) {
    delete memoryStore[roomId];
  } else {
    for (const k of Object.keys(memoryStore)) {
      delete memoryStore[k];
    }
  }
}

/* ------------------------------------------------------------------ */
/*  listRooms() – for admin inbox                                     */
/* ------------------------------------------------------------------ */

export async function listRooms(): Promise<ChatRoomSummary[]> {
  // --- Redis mode ---
  if (redis && redisHealthy) {
    try {
      const keys =
        ((await redis.keys("chat:room:*")) as string[] | null) ?? [];
      const rooms: ChatRoomSummary[] = [];

      for (const key of keys) {
        const roomId = key.replace("chat:room:", "");

        const rawLast = (await redis.lindex(key, -1)) as any;
        let lastMessage: ChatMessage | undefined;

        if (rawLast) {
          let msg: any = rawLast;

          if (typeof rawLast === "string") {
            if (rawLast !== "[object Object]") {
              try {
                msg = JSON.parse(rawLast);
              } catch {
                msg = undefined;
              }
            } else {
              msg = undefined;
            }
          }

          if (
            msg &&
            typeof msg === "object" &&
            typeof msg.createdAt === "string"
          ) {
            lastMessage = msg as ChatMessage;
          }
        }

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
      // If listing rooms fails, mark Redis unhealthy and fall back to memory
      markRedisFailed(err, "listRooms");
    }
  }

  // --- In-memory fallback ---
  const rooms: ChatRoomSummary[] = Object.entries(memoryStore).map(
    ([roomId, msgs]) => {
      const sorted = sortByTime(msgs);
      const last = sorted[sorted.length - 1];
      return {
        id: roomId,
        lastMessage: last,
        lastAt: last?.createdAt,
        lastSender: last?.sender,
      };
    }
  );

  rooms.sort((a, b) => {
    const aTime = a.lastAt ? Date.parse(a.lastAt) : 0;
    const bTime = b.lastAt ? Date.parse(b.lastAt) : 0;
    return bTime - aTime;
  });

  return rooms;
}
