// src/app/api/chat/store.ts
import type { ChatMessage } from "@/app/data/chat";
import { chatProvider, type NewMessageInput } from "./provider";

export type { ChatMessage };

export async function listMessages(): Promise<ChatMessage[]> {
  return chatProvider.list();
}

export async function addMessage(
  input: NewMessageInput,
): Promise<ChatMessage> {
  return chatProvider.add(input);
}

export async function resetMessages(): Promise<void> {
  return chatProvider.reset();
}
