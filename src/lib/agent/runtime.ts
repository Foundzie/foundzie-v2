import OpenAI from "openai";
import {
  FOUNDZIE_SYSTEM_PROMPT,
  coreTools,
} from "@/lib/agent/spec";
import { toolHandlers as toolImplementations } from "@/lib/agent/tools";

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

const openai = hasOpenAiKey
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  : null;

// -----------------------------------------------------
// M8b: Build personalization context from Users store
// -----------------------------------------------------
async function buildUserContextSuffix(
  req: AgentRequestPayload
): Promise<string> {
  try {
    // dynamic import to avoid circular issues
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

    if (user.interactionMode === "child") {
      bits.push("interactionMode=child");
    } else if (user.interactionMode === "normal") {
      bits.push("interactionMode=normal");
    }

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

    // appended at the end of the user message
    return `\n\n[User profile context: ${bits.join("; ")}]`;
  } catch (err) {
    console.error("[agent runtime] buildUserContextSuffix failed:", err);
    return "";
  }
}

// -----------------------------------------------------
// Stub agent (if key missing or errors)
// -----------------------------------------------------
async function runStubAgent(
  req: AgentRequestPayload,
  reason?: string
): Promise<AgentResult> {
  const trimmed = req.input.trim() || "a blank message";

  const replyText =
    `Foundzie (demo): I got “${trimmed}”. ` +
    `Right now I'm in a light demo mode on this device, ` +
    `but normally I'd use my full concierge brain plus tools ` +
    `to help you discover places, plan, or just chat with you.`;

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
// Helper: extract text from OpenAI message.content
// -----------------------------------------------------
function extractMessageText(message: any): string {
  if (!message) return "";

  // classic: content is a plain string
  if (typeof message.content === "string") {
    return message.content.trim();
  }

  // newer shapes: content is an array of parts
  if (Array.isArray(message.content)) {
    const parts = message.content as any[];
    const text = parts
      .map((p) => {
        if (!p) return "";
        if (typeof p === "string") return p;
        // v1 style: { type: "text", text: "..." }
        if (typeof p.text === "string") return p.text;
        // some new SDK shapes: { type: "...", text: { value: "..." } }
        if (p.text && typeof p.text.value === "string") return p.text.value;
        return "";
      })
      .join(" ")
      .trim();
    return text;
  }

  return "";
}

// -----------------------------------------------------
// Real OpenAI-powered agent
// -----------------------------------------------------
async function runOpenAiAgent(req: AgentRequestPayload): Promise<AgentResult> {
  if (!openai) {
    return runStubAgent(req, "no_openai_client");
  }

  const userText = req.input.trim() || "User sent a blank message.";

  const contextBits: string[] = [];
  if (req.source) contextBits.push(`source=${req.source}`);
  if (req.roomId) contextBits.push(`roomId=${req.roomId}`);
  if (req.userId) contextBits.push(`userId=${req.userId}`);

  const contextSuffix =
    contextBits.length > 0 ? `\n\n(Context: ${contextBits.join(", ")})` : "";

  // personalization (interactionMode, interest, tags, etc.)
  const profileSuffix = await buildUserContextSuffix(req);

  const finalUserContent = userText + contextSuffix + profileSuffix;

  const toolsMode = req.toolsMode ?? "off";
  const useTools = toolsMode === "debug";

  const openAiTools: any[] = coreTools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  // 1) First attempt – with tools (for admin / debug)
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

  const choice: any = completion.choices[0];
  const message: any = choice?.message ?? {};

  console.log("[agent runtime] raw OpenAI message:", JSON.stringify(message));

  let replyText = extractMessageText(message);

  // 2) Handle tool calls from first attempt
  const usedTools: string[] = [];
  const toolResults: Array<{ name: string; result: unknown }> = [];

  if (useTools && message.tool_calls && message.tool_calls.length > 0) {
    const toolCalls = message.tool_calls as any[];

    for (const rawCall of toolCalls) {
      const call: any = rawCall;

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

  // 3) Second attempt if still no text (sometimes content can be empty)
  if (!replyText) {
    try {
      const completion2 = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: FOUNDZIE_SYSTEM_PROMPT },
          {
            role: "user",
            content:
              finalUserContent +
              "\n\nSECOND ATTEMPT: Please respond with a short, friendly text answer for the concierge. Do NOT call tools this time.",
          },
        ],
        temperature: 0.4,
        max_tokens: 400,
      });

      const choice2: any = completion2.choices[0];
      const message2: any = choice2?.message ?? {};
      const secondText = extractMessageText(message2);

      if (secondText) {
        replyText = secondText;
      }
    } catch (err) {
      console.error(
        "[agent runtime] Second attempt for empty reply failed:",
        err
      );
    }
  }

  // 4) If still no text at all, synthesize a safe generic reply
  if (!replyText) {
    if (toolResults.length > 0) {
      replyText =
        "I've processed your request and updated the concierge system.";
    } else {
      replyText =
        "Foundzie: I received your message and I'm here, but my reply was empty. Please try asking again in a slightly different way.";
    }
  }

  // 5) Friendly summary of any tool actions
  if (toolResults.length > 0) {
    const actions: string[] = [];

    if (usedTools.includes("open_sos_case")) {
      actions.push("opened a new SOS case");
    }
    if (usedTools.includes("add_sos_note")) {
      actions.push("added a note to the SOS case");
    }
    if (usedTools.includes("log_outbound_call")) {
      actions.push("logged an outbound call with your note");
    }
    if (usedTools.includes("broadcast_notification")) {
      actions.push("sent a broadcast notification to users");
    }

    if (actions.length > 0) {
      let summary: string;
      if (actions.length === 1) {
        summary = `I've ${actions[0]}.`;
      } else if (actions.length === 2) {
        summary = `I've ${actions[0]} and ${actions[1]}.`;
      } else {
        const last = actions[actions.length - 1];
        const rest = actions.slice(0, -1).join(", ");
        summary = `I've ${rest}, and ${last}.`;
      }

      replyText =
        replyText.trim() +
        "\n\n" +
        `${summary} Your concierge team can now see this in the Foundzie admin system.`;
    }
  }

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
}

/**
 * Main entry point used by /api/chat/[roomId] and /api/agent.
 */
export async function runFoundzieAgent(
  req: AgentRequestPayload
): Promise<AgentResult> {
  try {
    if (!hasOpenAiKey || !openai) {
      return runStubAgent(req, "missing_or_empty_OPENAI_API_KEY");
    }

    return await runOpenAiAgent(req);
  } catch (err) {
    console.error("[agent runtime] OpenAI error, falling back to stub:", err);
    return runStubAgent(
      req,
      err instanceof Error ? err.message : String(err)
    );
  }
}
