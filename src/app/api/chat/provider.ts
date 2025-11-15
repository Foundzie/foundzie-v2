// src/app/api/chat/provider.ts

import type { ChatMessage, ChatSender } from "@/app/data/chat";
import { initialMessages } from "@/app/data/chat";

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

// In-memory store: roomId -> messages[]
let messagesByRoom: Record<string, ChatMessage[]> = {};

function ensureRoom(roomId: string = DEFAULT_ROOM_ID): ChatMessage[] {
  if (!messagesByRoom[roomId]) {
    // Fresh room starts with the welcome message
    messagesByRoom[roomId] = [...initialMessages];
  }
  return messagesByRoom[roomId];
}

export const chatProvider = {
  async list(roomId: string): Promise<ChatMessage[]> {
    return ensureRoom(roomId);
  },

  async add(roomId: string, input: NewMessageInput): Promise<ChatMessage> {
    const roomMessages = ensureRoom(roomId);

    const msg: ChatMessage = {
      id: String(Date.now()) + Math.random().toString(16).slice(2),
      sender: input.sender,
      text: input.text,
      createdAt: new Date().toISOString(),
      attachmentName: input.attachmentName ?? null,
      attachmentKind: input.attachmentKind ?? null,
    };

    roomMessages.push(msg);
    return msg;
  },

  async reset(roomId?: string): Promise<void> {
    if (roomId) {
      messagesByRoom[roomId] = [...initialMessages];
      return;
    }

    // Reset everything
    messagesByRoom = {};
  },

  async listRooms(): Promise<ChatRoomSummary[]> {
    // Ensure at least one default room exists so admin always sees something
    if (Object.keys(messagesByRoom).length === 0) {
      ensureRoom(DEFAULT_ROOM_ID);
    }

    return Object.entries(messagesByRoom).map(([id, msgs]) => {
      const last = msgs[msgs.length - 1];
      return {
        id,
        lastMessage: last,
        lastAt: last?.createdAt,
        lastSender: last?.sender,
      };
    });
  },
};
