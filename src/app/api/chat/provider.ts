// src/app/api/chat/provider.ts
import type { ChatMessage, ChatSender } from "../../data/chat";
import { initialMessages } from "../../data/chat";

let messages: ChatMessage[] = [...initialMessages];

export type NewMessageInput = {
  sender: ChatSender;
  text: string;
  attachmentName?: string | null;
  attachmentKind?: "image" | "file" | null;
};

export const chatProvider = {
  async list(): Promise<ChatMessage[]> {
    return messages;
  },

  async add(input: NewMessageInput): Promise<ChatMessage> {
    const msg: ChatMessage = {
      id: String(Date.now()) + Math.random().toString(16).slice(2),
      sender: input.sender,
      text: input.text,
      createdAt: new Date().toISOString(),
      attachmentName: input.attachmentName ?? null,
      attachmentKind: input.attachmentKind ?? null,
    };

    messages = [...messages, msg];
    return msg;
  },

  async reset(): Promise<void> {
    messages = [...initialMessages];
  },
};
