// src/app/data/chat.ts

export type ChatSender = "user" | "concierge";

export interface ChatMessage {
  id: string;
  sender: ChatSender;
  text: string;
  createdAt: string; // ISO string
}

// Starter messages shown on first load
export const initialMessages: ChatMessage[] = [
  {
    id: "welcome-1",
    sender: "concierge",
    text: "Hi, I’m Foundzie. Tell me what you need help with today.",
    createdAt: new Date().toISOString(),
  },
];
