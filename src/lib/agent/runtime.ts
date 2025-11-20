// src/lib/agent/runtime.ts

import OpenAI from "openai";
import {
  FOUNDZIE_SYSTEM_PROMPT,
  coreTools,
} from "@/lib/agent/spec";
import { toolImplementations } from "@/lib/agent/tools";

export type AgentSource = "mobile" | "admin" | "system";

export interface AgentRequestPayload {
  input: string;
  roomId?: string;
  userId?: string | null;
  source?: AgentSource;

  // NEW: how we want tools to behave
  // - "off"   → no tools, just text
  // - "debug" → allow tools, return tool info in debug panel
  toolsMode?: "off" | "debug";
}

export interface AgentResult {
  replyText: string;
  usedTools: string[];
  debug?: {
    systemPromptPreview: string;
    mode: "stub" | "openai";
    toolResults?: Array<{ name: string; result: unknown }>;
  };
}

// Single OpenAI client (server-side only)
const openai =
  typeof process !== "undefined" && process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

/**
 * Fallback stub behavior (what you had before).
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
 * Includes *optional* tool calls, but uses very loose typing (`any`)
 * so TypeScript stops yelling.
 */
async function runOpenAiAgent(req: AgentRequestPayload): Promise<AgentResult> {
  if (!openai) {
    return runStubAgent(req);
  }

  const userText = req.input.trim() || "User sent a blank message.";

  const contextBits: string[] = [];
  if (req.source) contextBits.push(`source=${req.source}`);
  if (req.roomId) contextBits.push(`roomId=${req.roomId}`);
  if (req.userId) contextBits.push(`userId=${req.userId}`);

  const contextSuffix =
    contextBits.length > 0 ? `\n\n(Context: ${contextBits.join(", ")})` : "";

  const finalUserContent = userText + contextSuffix;

  // Decide if tools are enabled for this request
  const toolsMode = req.toolsMode ?? "off";
  const useTools = toolsMode === "debug";

  // Convert our coreTools → OpenAI tool schema
  const openAiTools: any[] = coreTools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

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
    tools: useTools ? (openAiTools as any) : undefined,
    tool_choice: useTools ? "auto" : undefined,
    temperature: 0.6,
    max_tokens: 400,
  });

  const choice: any = completion.choices[0];
  const message: any = choice?.message ?? {};

  // -----------------------------
  // 1) Text reply
  // -----------------------------
  let replyText = "";

  if (typeof message.content === "string") {
    replyText = message.content.trim();
  } else if (Array.isArray(message.content)) {
    // Explicitly cast to any[] so TS doesn't complain about .map on 'never'
    const parts = message.content as any[];
    replyText =
      parts
        .map((p) =>
          typeof p === "string" ? p : typeof p?.text === "string" ? p.text : ""
        )
        .join(" ")
        .trim() || "";
  }

  if (!replyText) {
    replyText =
      "Foundzie: I received your message and I'm here, but my reply was empty. Please try asking again in a slightly different way.";
  }

  // -----------------------------
  // 2) Tool call handling
  // -----------------------------
  const usedTools: string[] = [];
  const toolResults: Array<{ name: string; result: unknown }> = [];

  if (useTools && message.tool_calls && message.tool_calls.length > 0) {
    // message.tool_calls type is annoying; treat as any[] so TS is quiet
    const toolCalls = message.tool_calls as any[];

    for (const rawCall of toolCalls) {
      const call: any = rawCall;

      // Some safety checks
      if (!call || call.type !== "function" || !call.function) {
        console.warn("[agent runtime] Unsupported tool call shape:", call);
        continue;
      }

      const toolName: string = call.function.name;
      const impl =
        (toolImplementations as Record<string, any>)[toolName];

      if (!impl) {
        console.warn(
          "[agent runtime] Model requested unknown tool:",
          toolName
        );
        continue;
      }

      let parsedArgs: any = {};
      try {
        const argStr = call.function.arguments;
        parsedArgs =
          typeof argStr === "string" && argStr.trim()
            ? JSON.parse(argStr)
            : {};
      } catch (err) {
        console.error(
          "[agent runtime] Failed to parse tool args:",
          call.function.arguments,
          err
        );
      }

      try {
        const result = await impl(parsedArgs);
        usedTools.push(toolName);
        toolResults.push({ name: toolName, result });
      } catch (err) {
        console.error(
          "[agent runtime] Tool execution failed:",
          toolName,
          err
        );
      }
    }
  }

  return {
    replyText,
    usedTools,
    debug: {
      systemPromptPreview: FOUNDZIE_SYSTEM_PROMPT.slice(0, 200),
      mode: "openai",
      toolResults,
    },
  };
}

/**
 * Main entry point used by /api/chat/[roomId] and /api/agent.
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
