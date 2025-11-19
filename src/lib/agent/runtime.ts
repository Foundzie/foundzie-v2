// src/lib/agent/runtime.ts

import {
  FOUNDZIE_SYSTEM_PROMPT,
  coreTools,
} from "@/lib/agent/spec";

export type AgentSource = "mobile" | "admin" | "system";

export interface AgentRequestPayload {
  input: string;
  roomId?: string;
  userId?: string | null;
  source?: AgentSource;
}

export interface AgentResult {
  replyText: string;
  usedTools: string[];
  debug?: {
    systemPromptPreview: string;
  };
}

/**
 * Stub runtime for Foundzie agent.
 * Later this will:
 * - Call OpenAI with FOUNDZIE_SYSTEM_PROMPT
 * - Decide on tool calls (open_sos_case, broadcast_notification, etc.)
 */
export async function runFoundzieAgent(
  req: AgentRequestPayload
): Promise<AgentResult> {
  const trimmed = req.input.trim() || "a blank message";

  const replyText =
    `Foundzie (stub): I received “${trimmed}”. ` +
    `In the next milestone I'll use the full concierge brain + tools to respond automatically.`;

  return {
    replyText,
    usedTools: coreTools.map((t) => t.name),
    debug: {
      systemPromptPreview: FOUNDZIE_SYSTEM_PROMPT.slice(0, 200),
    },
  };
}
