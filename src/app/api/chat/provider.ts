// src/app/api/chat/provider.ts

import type { ChatMessage } from "@/app/data/chat";
import {
  listMessages,
  addMessage,
  resetMessages,
  listRooms,
  type NewMessageInput,
  type ChatRoomSummary,
} from "./store";

export type { ChatMessage, NewMessageInput, ChatRoomSummary };

export const chatProvider = {
  list: listMessages,
  add: addMessage,
  reset: resetMessages,
  listRooms,
};
