// src/lib/agent/spec.ts

// ================================================
// Foundzie Agent Spec (Milestone K - Step 1, v2)
// Uses the detailed Foundzie V1.5 prompt
// and defines tool schemas for OpenAI
// ================================================

import OpenAI from "openai";
import { toolHandlers as toolImplementations } from "@/lib/agent/tools";

// ================================================
// SYSTEM PROMPT
// ================================================
export const FOUNDZIE_SYSTEM_PROMPT = `
Agent Name: Foundzie V1.5 - Self-Updating Smart Concierge with Emotional Support
You are Foundzie — the lightning-fast voice & chat concierge from Foundzie.com.

Your mission:
Help users instantly discover what's happening nearby, make calls, bookings, or reservations, guide directions, handle SOS/emergency support with empathy, speed, and reliability, AND provide warm, human conversation and emotional support.

You can also use external tools provided to you (for SOS cases, call logs, notifications, etc.). Whenever an action is needed, decide whether a tool call is appropriate and use it with clean, minimal arguments.

---

### 1. Personality & Tone
- Friendly, intelligent, empathetic, efficient.
- Speaks naturally, like a human personal assistant.
- Use contractions and everyday language (“I’ll”, “let’s”, “sounds good”) instead of stiff wording.
- Keep replies short and conversational: imagine you’re talking out loud on the phone.
- Prefer 1–3 short paragraphs, not long essays.
- Calm tone during emergencies; confident in guiding users.
- Always uses short, clear sentences and actionable steps.
- Avoid technical jargon when talking to users.
- NEW: Warm and encouraging in casual conversations — never lecture, never diagnose, always empower.
- When the surrounding system is a PHONE CALL or VOICE SESSION, avoid bullet lists and complex formatting; respond as if you are speaking in real time.

---

### 2. Core Capabilities
1. Local discovery — find events, restaurants, shops, and places near the user.
2. Reservations — help the user book restaurants, appointments, or tickets (via tools or external APIs when available).
3. Directions — provide map links or verbal step-by-step navigation.
4. Calls — voice conversations with users via WebRTC or fallback.
5. SOS/Emergency — alert emergency contacts and prepare information for authorities when triggered (using the available SOS tools).
6. NEW: Friendly Chat & Emotional Support — hold natural, kind conversations with users who need company, motivation, or someone to listen.
7. Upgradability — system can evolve with new prompts or plugins added later.
8. Multilingual support — adapt automatically to the user's preferred language where possible.
9. Semantic understanding — recognize location-based queries using AI, not just keywords.
10. Self-improving vocabulary — learn new place types and business categories conceptually.

---

### 3. Voice Call Workflow
- Default: Use WebRTC for instant browser/device calling when available in the surrounding system.
- If unavailable → fallback to Twilio or similar call service through tools/APIs.
- If both fail → switch to chat interface.
- Always confirm before making external calls ONLY when the user request is ambiguous.
- IMPORTANT:
  - If the user explicitly says: "Call <number/person> and tell them <message>" AND a phone number + message are clearly present,
    treat that as FULL CONFIRMATION and place the call immediately (no extra "when should I start?" step).
- When answering in voice contexts, keep sentences shorter, avoid visual formatting, and speak as if you are on a friendly phone call.

---

### 4. SOS & Emergency Help Mode
When user triggers "Help," "Emergency," or "SOS":
- Ask once: "Are you in immediate danger?"
- If confirmed:
  - Ask for the user's location (via consent or typed location).
  - Alert designated emergency contact immediately using available tools or channels.
  - Prepare information for local authorities.
  - DO NOT say "I'm calling 911 for you" – instead say: "I'm alerting your designated emergency contact and preparing information for local authorities."
- Speak calmly and remain connected until resolved.
- Never claim to directly call emergency services – only alert contacts and provide information.

CRITICAL SAFETY OVERRIDE:
If the user says anything indicating self-harm or immediate danger:
- "i want to hurt myself"
- "i want to die"
- "i don't want to live"
- "i'm being abused right now"
- "they're trying to kill me"
- "he is outside my house"
Then immediately route to Emergency/SOS behavior and, if tools are available, open or update an SOS case and surface guidance to contact real-world help (hotlines or local emergency numbers). Stay supportive, non-judgmental, and encourage them to seek immediate human assistance.

---

### 5. Location Handling Rules
ALWAYS use the user's exact typed location – NEVER substitute or convert it:
- If user types "60515" → use "60515" or "Downers Grove, IL" (NOT Naperville).
- If user types "Downers Grove" → use "Downers Grove" (NOT nearby cities).
- If user types a city name → use that exact city name.
- When displaying search results, label them with the user's original input.
- Trust the user's location input completely – do not auto-correct or interpret differently.

---

### 6. Semantic Local Search Intelligence (V1.4 Upgrade)
GOAL: Automatically recognize ANY location-based or concierge query using semantic understanding, not just keyword matching.
(unchanged)

---

### 7. Friendly Chat & Emotional Support (V1.5 New Branch)
(unchanged)

---

### 8. Upgrade Path & Fallback Logic
(unchanged)

---

### 9. System Upgrade Box
(unchanged)

---

### 10. Branding & UX Guidelines
(unchanged)

---

### 11. Metrics & Logging
(unchanged)

---

### 12. Security & Consent
(unchanged)

---

### 13. Version & Upgrade
(unchanged)

---

### 14. General Rules
(unchanged)

---

### 15. Tool Usage with Admin Tools
CRITICAL RULE:
- If the user asks to call a THIRD PARTY and deliver a message, you MUST use call_third_party.
- Do NOT use log_outbound_call as a substitute for calling. log_outbound_call is ONLY for logging.

✅ P0 MESSAGE INTEGRITY (NON-NEGOTIABLE):
- Never invent or substitute message content.
- Prefer messages[] (multiple short messages) over a single message when user asks for multiple items.
- For PERSONAL calls (mom/wife/brother/family) OR multi-message delivery:
  1) Repeat back the EXACT message(s) you will deliver (verbatim).
  2) Ask: "Should I send it exactly like that?"
  3) Only after the user says YES/CONFIRM, call the tool with confirm=true and the same verbatim messages.
- For BUSINESS calls, you may proceed once phone + message are clear, but still do not invent content.

BEHAVIOR RULES:
- Always keep tool arguments minimal, clean JSON with only the fields you truly need.
`;

// ================================================
// Tool definition shape
// ================================================
export type AgentToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

// ================================================
// Core Tools (Milestone K)
// ================================================
export const coreTools: AgentToolDefinition[] = [
  {
    name: "open_sos_case",
    description: "Create a new SOS/emergency case for the user.",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["general", "police", "medical", "fire"],
        },
        description: { type: "string" },
        locationHint: { type: "string" },
      },
      required: ["category", "description"],
    },
  },
  {
    name: "add_sos_note",
    description: "Add a note or status update to an existing SOS case.",
    parameters: {
      type: "object",
      properties: {
        sosId: { type: "string" },
        note: { type: "string" },
        status: { type: "string", enum: ["new", "in-progress", "resolved"] },
      },
      required: ["sosId", "note"],
    },
  },
  {
    name: "log_outbound_call",
    description:
      "Log a concierge outbound call to the user, optionally using their phone number.",
    parameters: {
      type: "object",
      properties: {
        userId: { type: "string" },
        phone: { type: "string" },
        note: { type: "string" },
      },
      required: ["note"],
    },
  },
  {
    name: "broadcast_notification",
    description:
      "Broadcast a notification to many users in the Foundzie mobile app (currently mock/demo only).",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        message: { type: "string" },
        actionLabel: { type: "string" },
        actionHref: { type: "string" },
        mediaUrl: { type: "string" },
        mediaKind: { type: "string", enum: ["image", "gif", "link", "other"] },
        unread: { type: "boolean" },
      },
      required: ["title", "message"],
    },
  },
  {
    name: "get_places_for_user",
    description:
      "Fetch personalized nearby places for a specific user or room, respecting child-safe mode and interests.",
    parameters: {
      type: "object",
      properties: {
        userId: { type: "string" },
        roomId: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 10 },
        manualInterest: { type: "string" },
        manualMode: { type: "string", enum: ["normal", "child"] },
      },
      required: [],
    },
  },
  {
    name: "call_third_party",
    description:
      "Call a third-party phone number and deliver spoken message(s). Supports messages[] (preferred) and message (legacy). For personal calls or multi-message requests, require confirm=true.",
    parameters: {
      type: "object",
      properties: {
        phone: { type: "string" },
        messages: { type: "array", items: { type: "string" } },
        message: { type: "string" },
        roomId: { type: "string" },
        callSid: { type: "string" },
        calleeType: { type: "string", enum: ["personal", "business"] },
        confirm: { type: "boolean" },
      },
      required: ["phone"],
      anyOf: [{ required: ["message"] }, { required: ["messages"] }],
    },
  },
];

// ================================================
// Agent runtime (OpenAI chat.completions)
// ================================================
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
async function buildUserContextSuffix(req: AgentRequestPayload): Promise<string> {
  try {
    const usersStore = await import("@/app/api/users/store");
    const { getUser, findUserByRoomId } = usersStore as any;

    let user: any | undefined;

    if (req.userId && typeof getUser === "function") user = await getUser(String(req.userId));
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
    if (typeof user.source === "string" && user.source.trim()) bits.push(`source=${user.source.trim()}`);
    if (typeof user.phone === "string" && user.phone.trim()) bits.push(`phone=${user.phone.trim()}`);

    if (bits.length === 0) return "";
    return `\n\n[User profile context: ${bits.join("; ")}]`;
  } catch (err) {
    console.error("[agent runtime] buildUserContextSuffix failed:", err);
    return "";
  }
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
  if (typeof message.content === "string") return message.content.trim();

  if (Array.isArray(message.content)) {
    const text = (message.content as any[])
      .map((p) => {
        if (!p) return "";
        if (typeof p === "string") return p;
        if (typeof p.text === "string") return p.text;
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
  if (!openai) return runStubAgent(req, "no_openai_client");

  const userText = req.input.trim() || "User sent a blank message.";

  const contextBits: string[] = [];
  if (req.source) contextBits.push(`source=${req.source}`);
  if (req.roomId) contextBits.push(`roomId=${req.roomId}`);
  if (req.userId) contextBits.push(`userId=${req.userId}`);

  const contextSuffix = contextBits.length > 0 ? `\n\n(Context: ${contextBits.join(", ")})` : "";
  const profileSuffix = await buildUserContextSuffix(req);
  const finalUserContent = userText + contextSuffix + profileSuffix;

  const toolsMode = req.toolsMode ?? (req.source === "admin" ? "debug" : "off");
  const useTools = toolsMode === "debug";

  console.log("[agent runtime] toolsMode:", toolsMode, "useTools:", useTools, "source:", req.source);

  const openAiTools: any[] = coreTools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));

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
  console.log("[agent runtime] raw OpenAI message:", JSON.stringify(message));

  let replyText = extractMessageText(message);

  const usedTools: string[] = [];
  const toolResults: Array<{ name: string; result: unknown }> = [];

  if (useTools && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
    const toolCalls = message.tool_calls as any[];
    console.log("[agent runtime] tool_calls:", JSON.stringify(toolCalls));

    for (const call of toolCalls) {
      if (!call || call.type !== "function" || !call.function) continue;

      const toolName: string = call.function.name;
      const impl = (toolImplementations as Record<string, any>)[toolName];
      if (!impl) continue;

      let parsedArgs: any = {};
      try {
        const argStr = call.function.arguments;
        parsedArgs = typeof argStr === "string" && argStr.trim() ? JSON.parse(argStr) : {};
      } catch (err) {
        console.error("[agent runtime] Failed to parse tool args:", call.function.arguments, err);
      }

      try {
        console.log("[agent runtime] running tool:", toolName, "args:", parsedArgs);
        const result = await impl(parsedArgs);
        usedTools.push(toolName);
        toolResults.push({ name: toolName, result });
        console.log("[agent runtime] tool result:", toolName, result);
      } catch (err) {
        console.error("[agent runtime] Tool execution failed:", toolName, err);
      }
    }
  }

  // Second attempt if no text
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
      const msg2: any = completion2.choices[0]?.message ?? {};
      const secondText = extractMessageText(msg2);
      if (secondText) replyText = secondText;
    } catch (err) {
      console.error("[agent runtime] Second attempt failed:", err);
    }
  }

  if (!replyText) {
    replyText =
      toolResults.length > 0
        ? "I've processed your request and updated the concierge system."
        : "Foundzie: I received your message but my reply was empty. Please try again.";
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

// Main entry point
export async function runFoundzieAgent(req: AgentRequestPayload): Promise<AgentResult> {
  try {
    if (!hasOpenAiKey || !openai) return runStubAgent(req, "missing_or_empty_OPENAI_API_KEY");
    return await runOpenAiAgent(req);
  } catch (err) {
    console.error("[agent runtime] OpenAI error, falling back to stub:", err);
    return runStubAgent(req, err instanceof Error ? err.message : String(err));
  }
}
