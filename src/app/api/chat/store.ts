// src/app/api/chat/store.ts

import type { ChatMessage } from "@/app/data/chat";
import {
  chatProvider,
  type NewMessageInput,
  type ChatRoomSummary,
} from "./provider";

export type { ChatMessage, ChatRoomSummary };

/**
 * List all messages for a given room.
 */
export async function listMessages(roomId: string): Promise<ChatMessage[]> {
  return chatProvider.list(roomId);
}

/**
 * Add a new message to a room (user or concierge).
 */
export async function addMessage(
  roomId: string,
  input: NewMessageInput
): Promise<ChatMessage> {
  return chatProvider.add(roomId, input);
}

/**
 * Reset messages, either for a single room or globally.
 */
export async function resetMessages(roomId?: string): Promise<void> {
  return chatProvider.reset(roomId);
}

/**
 * List all known chat rooms (used by the admin chat inbox).
 */
export async function listRooms(): Promise<ChatRoomSummary[]> {
  return chatProvider.listRooms();
}
