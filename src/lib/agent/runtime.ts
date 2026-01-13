// src/lib/agent/runtime.ts
import "server-only";
import OpenAI from "openai";
import { FOUNDZIE_SYSTEM_PROMPT, coreTools } from "@/lib/agent/spec";
import { toolHandlers as toolImplementations } from "@/lib/agent/tools";
import { recordAgentCall } from "@/app/api/health/store";

export type AgentSource = "mobile" | "admin" | "system";

export interface AgentRequestPayload {
  input: string;
  roomId?: string;
  userId?: string | null;
  source?: AgentSource;
  toolsMode?: "off" | "debug";
}

export interface AgentResult {
  replyText: string;
  usedTools: string[];
  debug?: {
    systemPromptPreview: string;
    mode: "stub" | "openai" | "error";
    toolResults?: Array<{ name: string; result: unknown }>;
    hasKey?: boolean;
    rawError?: string;
  };
}

// -----------------------------------------------------
// OpenAI client wiring
// -----------------------------------------------------
const hasOpenAiKey =
  typeof process !== "undefined" &&
  typeof process.env.OPENAI_API_KEY === "string" &&
  process.env.OPENAI_API_KEY.trim().length > 0;

console.log("[agent runtime] has OPENAI_API_KEY?", hasOpenAiKey);

const openai = hasOpenAiKey ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY! }) : null;

// -----------------------------------------------------
// Build personalization context from Users store
// -----------------------------------------------------
async function buildUserContextSuffix(req: AgentRequestPayload): Promise<string> {
  try {
    const usersStore = await import("@/app/api/users/store");
    const { getUser, findUserByRoomId } = usersStore as any;

    let user: any | undefined;

    if (req.userId && typeof getUser === "function") {
      user = await getUser(String(req.userId));
    }

    if (!user && req.roomId && typeof findUserByRoomId === "function") {
      user = await findUserByRoomId(String(req.roomId));
    }

    if (!user) return "";

    const bits: string[] = [];

    if (user.interactionMode === "child") bits.push("interactionMode=child");
    else if (user.interactionMode === "normal") bits.push("interactionMode=normal");

    if (typeof user.interest === "string" && user.interest.trim()) {
      bits.push(`interest="${user.interest.trim()}"`);
    }

    if (Array.isArray(user.tags) && user.tags.length > 0) {
      const shortTags = user.tags.slice(0, 6).map((t: string) => String(t));
      bits.push(`tags=[${shortTags.join(", ")}]`);
    }

    if (typeof user.source === "string" && user.source.trim()) {
      bits.push(`source=${user.source.trim()}`);
    }

    if (typeof user.phone === "string" && user.phone.trim()) {
      bits.push(`phone=${user.phone.trim()}`);
    }

    if (bits.length === 0) return "";
    return `\n\n[User profile context: ${bits.join("; ")}]`;
  } catch (err) {
    console.error("[agent runtime] buildUserContextSuffix failed:", err);
    return "";
  }
}

// -----------------------------------------------------
// Helper: extract text from OpenAI message.content
// -----------------------------------------------------
function extractMessageText(message: any): string {
  if (!message) return "";

  if (typeof message.content === "string") return message.content.trim();

  if (Array.isArray(message.content)) {
    const parts = message.content as any[];
    return parts
      .map((p) => {
        if (!p) return "";
        if (typeof p === "string") return p;
        if (typeof p.text === "string") return p.text;
        if (p.text && typeof p.text.value === "string") return p.text.value;
        return "";
      })
      .join(" ")
      .trim();
  }

  return "";
}

// -----------------------------------------------------
// Stub agent (if key missing or errors)
// -----------------------------------------------------
async function runStubAgent(req: AgentRequestPayload, reason?: string): Promise<AgentResult> {
  const trimmed = req.input.trim() || "a blank message";

  const replyText =
    `Foundzie (demo): I got “${trimmed}”. ` +
    `Right now I'm in a light demo mode on this device, ` +
    `but normally I'd use my full concierge brain plus tools ` +
    `to help you discover places, plan, or just chat with you.`;

  // Count as a run (not an error)
  await recordAgentCall(true).catch(() => null);

  return {
    replyText,
    usedTools: coreTools.map((t) => t.name),
    debug: {
      systemPromptPreview: FOUNDZIE_SYSTEM_PROMPT.slice(0, 200),
      mode: "stub",
      hasKey: hasOpenAiKey,
      rawError: reason ? String(reason) : undefined,
    },
  };
}

// -----------------------------------------------------
// Real OpenAI-powered agent
// -----------------------------------------------------
async function runOpenAiAgent(req: AgentRequestPayload): Promise<AgentResult> {
  if (!openai) return runStubAgent(req, "no_openai_client");

  const userText = req.input.trim() || "User sent a blank message.";

  const contextBits: string[] = [];
  if (req.source) contextBits.push(`source=${req.source}`);
  if (req.roomId) contextBits.push(`roomId=${req.roomId}`);
  if (req.userId) contextBits.push(`userId=${req.userId}`);

  const contextSuffix = contextBits.length ? `\n\n(Context: ${contextBits.join(", ")})` : "";
  const profileSuffix = await buildUserContextSuffix(req);
  const finalUserContent = userText + contextSuffix + profileSuffix;

  const toolsMode = req.toolsMode ?? (req.source === "admin" ? "debug" : "off");
  const useTools = toolsMode === "debug";

  const openAiTools: any[] = coreTools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));

  let replyText = "";
  const usedTools: string[] = [];
  const toolResults: Array<{ name: string; result: unknown }> = [];

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: FOUNDZIE_SYSTEM_PROMPT },
        { role: "user", content: finalUserContent },
      ],
      tools: useTools ? (openAiTools as any) : undefined,
      tool_choice: useTools ? "auto" : undefined,
      temperature: 0.4,
      max_tokens: 400,
    });

    const message: any = completion.choices[0]?.message ?? {};
    replyText = extractMessageText(message);

    if (useTools && Array.isArray(message.tool_calls) && message.tool_calls.length) {
      for (const call of message.tool_calls as any[]) {
        if (!call || call.type !== "function" || !call.function) continue;

        const toolName: string = call.function.name;
        const impl = (toolImplementations as Record<string, any>)[toolName];
        if (!impl) continue;

        let parsedArgs: any = {};
        try {
          parsedArgs = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        } catch {
          parsedArgs = {};
        }

        try {
          const result = await impl(parsedArgs);
          usedTools.push(toolName);
          toolResults.push({ name: toolName, result });
        } catch (err) {
          console.error("[agent runtime] Tool execution failed:", toolName, err);
        }
      }
    }

    if (!replyText) {
      const completion2 = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: FOUNDZIE_SYSTEM_PROMPT },
          {
            role: "user",
            content:
              finalUserContent +
              "\n\nSECOND ATTEMPT: Please respond with a short, friendly text answer. Do NOT call tools this time.",
          },
        ],
        temperature: 0.4,
        max_tokens: 400,
      });

      const msg2: any = completion2.choices[0]?.message ?? {};
      const secondText = extractMessageText(msg2);
      if (secondText) replyText = secondText;
    }

    if (!replyText) {
      replyText =
        toolResults.length > 0
          ? "I've processed your request and updated the concierge system."
          : "Foundzie: I received your message but my reply was empty. Please try again.";
    }

    // ✅ success run
    await recordAgentCall(true).catch(() => null);

    return {
      replyText,
      usedTools,
      debug: {
        systemPromptPreview: FOUNDZIE_SYSTEM_PROMPT.slice(0, 200),
        mode: "openai",
        toolResults,
        hasKey: hasOpenAiKey,
      },
    };
  } catch (err: any) {
    console.error("[agent runtime] OpenAI error:", err);

    // ✅ error run
    await recordAgentCall(false, err).catch(() => null);

    return runStubAgent(req, err instanceof Error ? err.message : String(err));
  }
}

export async function runFoundzieAgent(req: AgentRequestPayload): Promise<AgentResult> {
  try {
    if (!hasOpenAiKey || !openai) {
      return runStubAgent(req, "missing_or_empty_OPENAI_API_KEY");
    }

    return await runOpenAiAgent(req);
  } catch (err) {
    console.error("[agent runtime] Outer error:", err);
    await recordAgentCall(false, err).catch(() => null);
    return runStubAgent(req, err instanceof Error ? err.message : String(err));
  }
}
