// src/app/api/chat/store.ts

// src/app/api/chat/store.ts
import type { ChatMessage } from "@/app/data/chat";
import {
  chatProvider,
  type NewMessageInput,
  type ChatRoomSummary,
} from "./provider";

export type { ChatMessage, ChatRoomSummary };

export async function listMessages(roomId: string): Promise<ChatMessage[]> {
  return chatProvider.list(roomId);
}

export async function addMessage(
  roomId: string,
  input: NewMessageInput
): Promise<ChatMessage> {
  return chatProvider.add(roomId, input);
}

export async function resetMessages(roomId?: string): Promise<void> {
  return chatProvider.reset(roomId);
}

export async function listRooms(): Promise<ChatRoomSummary[]> {
  return chatProvider.listRooms();
}
