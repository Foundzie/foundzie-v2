// src/lib/agent/runtime.ts

import OpenAI from "openai";
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
    mode: "stub" | "openai";
  };
}

// Create a single OpenAI client (server-side only)
const openai =
  typeof process !== "undefined" && process.env.OPENAI_API_KEY
    ? new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      })
    : null;

/**
 * Fallback stub behavior (what you had before).
 * We keep this so nothing breaks if OpenAI is not configured.
 */
async function runStubAgent(req: AgentRequestPayload): Promise<AgentResult> {
  const trimmed = req.input.trim() || "a blank message";

  const replyText =
    `Foundzie (stub): I received “${trimmed}”. ` +
    `In the next milestone I'll use the full concierge brain + tools to respond automatically.`;

  return {
    replyText,
    usedTools: coreTools.map((t) => t.name),
    debug: {
      systemPromptPreview: FOUNDZIE_SYSTEM_PROMPT.slice(0, 200),
      mode: "stub",
    },
  };
}

/**
 * Real OpenAI-powered agent.
 * For now this only returns text (no live tool-calls yet).
 * Tool integration will be a separate step so we don't risk breaking chat.
 */
async function runOpenAiAgent(req: AgentRequestPayload): Promise<AgentResult> {
  if (!openai) {
    // Safety net: if key is missing, just behave like stub.
    return runStubAgent(req);
  }

  const userText = req.input.trim() || "User sent a blank message.";
  const contextBits: string[] = [];

  if (req.source) contextBits.push(`source=${req.source}`);
  if (req.roomId) contextBits.push(`roomId=${req.roomId}`);
  if (req.userId) contextBits.push(`userId=${req.userId}`);

  const contextSuffix =
    contextBits.length > 0
      ? `\n\n(Context: ${contextBits.join(", ")})`
      : "";

  const finalUserContent = userText + contextSuffix;

  // Call OpenAI chat completions
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: FOUNDZIE_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: finalUserContent,
      },
    ],
    temperature: 0.6,
    max_tokens: 400,
  });

  const replyText =
    completion.choices[0]?.message?.content?.trim() ||
    "Foundzie: I received your message and I'm here, but my reply was empty. Please try asking again in a slightly different way.";

  return {
    replyText,
    usedTools: [], // we'll populate this when we wire actual tools
    debug: {
      systemPromptPreview: FOUNDZIE_SYSTEM_PROMPT.slice(0, 200),
      mode: "openai",
    },
  };
}

/**
 * Main entry point used by /api/chat/[roomId] and (optionally) /api/agent.
 * - If OpenAI key exists → use real agent.
 * - If not → safe stub behavior.
 */
export async function runFoundzieAgent(
  req: AgentRequestPayload
): Promise<AgentResult> {
  try {
    if (!openai) {
      return runStubAgent(req);
    }
    return await runOpenAiAgent(req);
  } catch (err) {
    console.error("[agent runtime] OpenAI error, falling back to stub:", err);
    return runStubAgent(req);
  }
}
