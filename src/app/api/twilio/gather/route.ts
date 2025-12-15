import { NextRequest, NextResponse } from "next/server";
import { runFoundzieAgent } from "@/lib/agent/runtime";
import { kvGetJSON, kvSetJSON } from "@/lib/kv/redis";
import { addMessage, listMessages } from "@/app/api/chat/store";
import { ensureUserForRoom } from "@/app/api/users/store";

export const dynamic = "force-dynamic";

type CallMemory = {
  startedAt: string;
  roomId?: string;
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
    } catch {}
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

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${safe}</Say>
  <Gather input="speech" action="${gatherUrl}" method="POST" timeout="7" speechTimeout="auto">
    <Say voice="alice">What else can I help you with?</Say>
  </Gather>
  <Say voice="alice">I did not hear anything. We can try again.</Say>
  <Redirect method="POST">${voiceUrl}</Redirect>
</Response>`;
}

function buildNoSpeechTwiml() {
  const base = getBaseUrl();
  const gatherUrl = base ? `${base}/api/twilio/gather` : `/api/twilio/gather`;
  const voiceUrl = base ? `${base}/api/twilio/voice` : `/api/twilio/voice`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${gatherUrl}" method="POST" timeout="7" speechTimeout="auto">
    <Say voice="alice">Sorry, I didn’t catch that. Please say it again.</Say>
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
  return `foundzie:twilio:call:${callSid}:v2`;
}

function trimTurns(turns: CallMemory["turns"], max = 10) {
  if (turns.length <= max) return turns;
  return turns.slice(turns.length - max);
}

function normalizePhoneToRoomId(phone: string) {
  const clean = (phone || "").trim();
  if (!clean) return "phone:unknown";
  return `phone:${clean}`;
}

function formatThreadForAgent(items: any[], max = 16) {
  const tail = items.slice(Math.max(0, items.length - max));
  return tail
    .map((m) => `${m.sender === "user" ? "User" : "Foundzie"}: ${m.text ?? ""}`.trim())
    .filter(Boolean)
    .join("\n");
}

export async function GET() {
  return twiml(buildConversationalTwiml("Twilio gather is live. Call your Foundzie number to chat."));
}

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);

  const speechTextRaw = form ? form.get("SpeechResult") : null;
  const callSidRaw = form ? form.get("CallSid") : null;
  const fromRaw = form ? form.get("From") : null;

  const speechText = typeof speechTextRaw === "string" ? speechTextRaw.trim() : "";
  const callSid = typeof callSidRaw === "string" && callSidRaw.trim() ? callSidRaw.trim() : "unknown-call";
  const fromPhone = typeof fromRaw === "string" ? fromRaw.trim() : "";

  if (!speechText) {
    return twiml(buildNoSpeechTwiml());
  }

  // Load memory
  let memory: CallMemory = { startedAt: new Date().toISOString(), turns: [] };

  try {
    const existing = await kvGetJSON<CallMemory>(memKey(callSid));
    if (existing && Array.isArray(existing.turns)) memory = existing;
  } catch {}

  // Resolve roomId (M9d): map caller → roomId
  const roomId = memory.roomId || normalizePhoneToRoomId(fromPhone);
  memory.roomId = roomId;

  // Ensure user exists for this roomId
  try {
    await ensureUserForRoom(roomId, {
      source: "twilio",
      tags: ["phone-call"],
      ...(fromPhone ? { phone: fromPhone } : {}),
    } as any);
  } catch {}

  // Turn limit
  const userTurnsSoFar = memory.turns.filter((t) => t.role === "user").length;
  if (userTurnsSoFar >= 10) {
    return twiml(buildGoodbyeTwiml("We’ve covered a lot—let’s continue in the Foundzie app."));
  }

  // Save user turn (call memory + shared chat store)
  memory.turns.push({ role: "user", text: speechText, at: new Date().toISOString() });
  memory.turns = trimTurns(memory.turns, 10);

  try {
    await addMessage(roomId, {
      sender: "user",
      text: `[Phone] ${speechText}`,
      attachmentName: null,
      attachmentKind: null,
    });
  } catch {}

  // Build agent input from shared thread (chat store)
  let thread = "";
  try {
    const items = await listMessages(roomId);
    thread = formatThreadForAgent(items as any[], 16);
  } catch {}

  const agentInput =
    `You are Foundzie, a lightning-fast personal concierge.\n` +
    `You are speaking on a PHONE CALL (Twilio). Keep replies short (1–3 sentences).\n` +
    `Ask exactly ONE follow-up question when needed.\n\n` +
    (thread ? `Shared conversation memory:\n${thread}\n\n` : "") +
    `Now respond to the caller's latest message:\n${speechText}`;

  let replyText = "Got it. What city or ZIP code are you in so I can tailor it?";

  try {
    const agentResult = await runFoundzieAgent({
      input: agentInput,
      roomId,
      userId: roomId,
      source: "mobile",
      toolsMode: "off",
    });

    if (agentResult.replyText && agentResult.replyText.trim()) {
      replyText = agentResult.replyText.trim().slice(0, 500);
    }
  } catch (err) {
    console.error("[twilio/gather] Agent error:", err);
  }

  // Save assistant turn (call memory + shared chat store)
  memory.turns.push({ role: "assistant", text: replyText, at: new Date().toISOString() });
  memory.turns = trimTurns(memory.turns, 10);

  try {
    await kvSetJSON(memKey(callSid), memory);
  } catch {}

  try {
    await addMessage(roomId, {
      sender: "concierge",
      text: `[Phone] ${replyText}`,
      attachmentName: null,
      attachmentKind: null,
    });
  } catch {}

  return twiml(buildConversationalTwiml(replyText));
}
