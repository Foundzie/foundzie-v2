// src/app/api/twilio/gather/route.ts
import { NextRequest, NextResponse } from "next/server";
import { runFoundzieAgent } from "@/lib/agent/runtime";
import { kvGetJSON, kvSetJSON } from "@/lib/kv/redis";

export const dynamic = "force-dynamic";

type CallMemory = {
  startedAt: string;
  turns: Array<{ role: "user" | "assistant"; text: string; at: string }>;
};

function escapeForXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function twiml(xml: string) {
  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

function getBaseUrl(): string | null {
  const explicit = process.env.TWILIO_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const voiceUrl = process.env.TWILIO_VOICE_URL?.trim();
  if (voiceUrl) {
    try {
      const u = new URL(voiceUrl);
      return `${u.protocol}//${u.host}`;
    } catch {
      // ignore
    }
  }

  const nextPublic = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (nextPublic) return nextPublic.replace(/\/+$/, "");

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl.replace(/\/+$/, "")}`;

  return null;
}

function buildConversationalTwiml(sayMessage: string) {
  const safe = escapeForXml((sayMessage || "").trim());
  const base = getBaseUrl();

  const gatherUrl = base ? `${base}/api/twilio/gather` : `/api/twilio/gather`;
  const voiceUrl = base ? `${base}/api/twilio/voice` : `/api/twilio/voice`;

  // After we say something, we immediately Gather again (multi-turn loop).
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${safe}</Say>

  <Gather
    input="speech"
    action="${gatherUrl}"
    method="POST"
    timeout="7"
    speechTimeout="auto"
  >
    <Say voice="alice">
      What else can I help you with?
    </Say>
  </Gather>

  <Say voice="alice">
    I did not hear anything. We can try again.
  </Say>
  <Redirect method="POST">${voiceUrl}</Redirect>
</Response>`;
}

function buildNoSpeechTwiml() {
  const base = getBaseUrl();
  const gatherUrl = base ? `${base}/api/twilio/gather` : `/api/twilio/gather`;
  const voiceUrl = base ? `${base}/api/twilio/voice` : `/api/twilio/voice`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather
    input="speech"
    action="${gatherUrl}"
    method="POST"
    timeout="7"
    speechTimeout="auto"
  >
    <Say voice="alice">
      Sorry, I didn’t catch that. Please say it again.
    </Say>
  </Gather>

  <Say voice="alice">No problem. Let’s restart.</Say>
  <Redirect method="POST">${voiceUrl}</Redirect>
</Response>`;
}

function buildGoodbyeTwiml(message: string) {
  const safe = escapeForXml((message || "").trim());
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${safe}</Say>
  <Say voice="alice">Thanks for calling Foundzie. Goodbye.</Say>
  <Hangup/>
</Response>`;
}

function memKey(callSid: string) {
  return `foundzie:twilio:call:${callSid}:v1`;
}

function trimTurns(turns: CallMemory["turns"], max = 10) {
  if (turns.length <= max) return turns;
  return turns.slice(turns.length - max);
}

export async function GET() {
  // Quick sanity test in browser
  return twiml(
    buildConversationalTwiml(
      "Twilio gather is live. Call your Foundzie number to chat."
    )
  );
}

export async function POST(req: NextRequest) {
  // Twilio sends x-www-form-urlencoded fields; Next parses via formData()
  const form = await req.formData().catch(() => null);

  const speechTextRaw = form ? form.get("SpeechResult") : null;
  const callSidRaw = form ? form.get("CallSid") : null;

  const speechText =
    typeof speechTextRaw === "string" ? speechTextRaw.trim() : "";
  const callSid =
    typeof callSidRaw === "string" && callSidRaw.trim()
      ? callSidRaw.trim()
      : "unknown-call";

  if (!speechText) {
    return twiml(buildNoSpeechTwiml());
  }

  // Load memory for this call (graceful fallback if KV is unavailable)
  let memory: CallMemory = {
    startedAt: new Date().toISOString(),
    turns: [],
  };

  try {
    const existing = await kvGetJSON<CallMemory>(memKey(callSid));
    if (existing && Array.isArray(existing.turns)) {
      memory = existing;
    }
  } catch {
    // KV not available — run without memory
  }

  // Turn limit (prevents endless loops/cost)
  const userTurnsSoFar = memory.turns.filter((t) => t.role === "user").length;
  if (userTurnsSoFar >= 10) {
    return twiml(
      buildGoodbyeTwiml(
        "We’ve covered a lot—let’s continue in the Foundzie app."
      )
    );
  }

  // Add user turn
  memory.turns.push({
    role: "user",
    text: speechText,
    at: new Date().toISOString(),
  });
  memory.turns = trimTurns(memory.turns, 10);

  // Build a lightweight conversation context for the agent
  const transcript = memory.turns
    .map((t) => `${t.role === "user" ? "User" : "Foundzie"}: ${t.text}`)
    .join("\n");

  const agentInput =
    `You are Foundzie, a lightning-fast personal concierge.\n` +
    `You are currently speaking on a phone call (Twilio). Keep replies short (1–3 sentences).\n` +
    `Ask exactly ONE follow-up question when needed to continue the conversation.\n\n` +
    `Conversation so far:\n${transcript}\n\n` +
    `Now respond to the user's latest message.`;

  let replyText =
    "Got it. I can help with that. What city or ZIP code are you in so I can tailor it?";

  try {
    const agentResult = await runFoundzieAgent({
      input: agentInput,
      source: "mobile",
      toolsMode: "off",
    });

    if (agentResult.replyText && agentResult.replyText.trim()) {
      replyText = agentResult.replyText.trim().slice(0, 500);
    }
  } catch (err) {
    console.error("[twilio/gather] Agent error:", err);
  }

  // Save assistant turn
  memory.turns.push({
    role: "assistant",
    text: replyText,
    at: new Date().toISOString(),
  });
  memory.turns = trimTurns(memory.turns, 10);

  try {
    await kvSetJSON(memKey(callSid), memory);
  } catch (e) {
    // KV not available — ignore
    console.error("[twilio/gather] Failed saving call memory:", e);
  }

  return twiml(buildConversationalTwiml(replyText));
}
