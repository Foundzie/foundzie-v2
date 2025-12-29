// src/app/api/twilio/gather/route.ts
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

const FALLBACK_TTS_VOICE =
  (process.env.TWILIO_FALLBACK_VOICE || "").trim() || "Polly.Joanna-Neural";

function escapeForXml(text: string): string {
  return (text || "")
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

function getBaseUrl(): string {
  const explicit = process.env.TWILIO_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const nextPublic = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (nextPublic) return nextPublic.replace(/\/+$/, "");

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl.replace(/\/+$/, "")}`;

  return "https://foundzie-v2.vercel.app";
}

function buildConversationalTwiml(sayMessage: string) {
  const safe = escapeForXml((sayMessage || "").trim());
  const base = getBaseUrl();

  const gatherUrl = `${base}/api/twilio/gather`;
  const voiceUrl = `${base}/api/twilio/voice`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">${safe}</Say>
  <Gather input="speech" action="${escapeForXml(gatherUrl)}" method="POST" timeout="7" speechTimeout="auto">
    <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">What can I do for you next?</Say>
  </Gather>
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">I didn’t hear anything. Let’s restart.</Say>
  <Redirect method="POST">${escapeForXml(voiceUrl)}</Redirect>
</Response>`;
}

function buildNoSpeechTwiml() {
  const base = getBaseUrl();
  const gatherUrl = `${base}/api/twilio/gather`;
  const voiceUrl = `${base}/api/twilio/voice`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${escapeForXml(gatherUrl)}" method="POST" timeout="7" speechTimeout="auto">
    <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">Sorry, I didn’t catch that. Say it one more time.</Say>
  </Gather>
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">No worries. Restarting.</Say>
  <Redirect method="POST">${escapeForXml(voiceUrl)}</Redirect>
</Response>`;
}

function buildGoodbyeTwiml(message: string) {
  const safe = escapeForXml((message || "").trim());
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">${safe}</Say>
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">Thanks for calling Foundzie. Bye for now.</Say>
  <Hangup/>
</Response>`;
}

function memKey(callSid: string) {
  return `foundzie:twilio:call:${callSid}:v3`;
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
    .map((m) =>
      `${m.sender === "user" ? "User" : "Foundzie"}: ${m.text ?? ""}`.trim()
    )
    .filter(Boolean)
    .join("\n");
}

export async function GET() {
  return twiml(
    buildConversationalTwiml(
      "Fallback voice mode is active. If realtime streaming is working, you should barely hear me here."
    )
  );
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData().catch(() => null);

    const speechTextRaw = form ? form.get("SpeechResult") : null;
    const callSidRaw = form ? form.get("CallSid") : null;
    const fromRaw = form ? form.get("From") : null;

    const speechText =
      typeof speechTextRaw === "string" ? speechTextRaw.trim() : "";
    const callSid =
      typeof callSidRaw === "string" && callSidRaw.trim()
        ? callSidRaw.trim()
        : "unknown-call";
    const fromPhone = typeof fromRaw === "string" ? fromRaw.trim() : "";

    if (!speechText) return twiml(buildNoSpeechTwiml());

    // Load memory
    let memory: CallMemory = { startedAt: new Date().toISOString(), turns: [] };
    try {
      const existing = await kvGetJSON<CallMemory>(memKey(callSid));
      if (existing && Array.isArray(existing.turns)) memory = existing;
    } catch {}

    // roomId mapping
    const roomId = memory.roomId || normalizePhoneToRoomId(fromPhone);
    memory.roomId = roomId;

    // Ensure user
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
      return twiml(
        buildGoodbyeTwiml("We covered a lot—let’s continue inside the Foundzie app.")
      );
    }

    // Save user turn
    memory.turns.push({
      role: "user",
      text: speechText,
      at: new Date().toISOString(),
    });
    memory.turns = trimTurns(memory.turns, 10);

    try {
      await addMessage(roomId, {
        sender: "user",
        text: `[Phone] ${speechText}`,
        attachmentName: null,
        attachmentKind: null,
      });
    } catch {}

    // Build agent thread
    let thread = "";
    try {
      const items = await listMessages(roomId);
      thread = formatThreadForAgent(items as any[], 16);
    } catch {}

    const agentInput =
      `You are Foundzie, a lightning-fast personal concierge.\n` +
      `You are speaking on a PHONE CALL. Sound natural.\n` +
      `Keep replies short (1–2 sentences).\n` +
      `Ask exactly ONE follow-up question when needed.\n\n` +
      (thread ? `Shared conversation memory:\n${thread}\n\n` : "") +
      `Now respond to the caller's latest message:\n${speechText}`;

    let replyText = "Got it — what city or ZIP code are you in?";

    try {
      const agentResult = await runFoundzieAgent({
        input: agentInput,
        roomId,
        userId: roomId,
        source: "mobile",
        toolsMode: "debug",
      });

      if (agentResult.replyText && agentResult.replyText.trim()) {
        replyText = agentResult.replyText.trim().slice(0, 500);
      }
    } catch (err) {
      console.error("[twilio/gather] Agent error:", err);
      replyText =
        "I hit a small snag on my side. What city or ZIP code are you in, and what are you trying to do?";
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
  } catch (e) {
    console.error("[twilio/gather] fatal:", e);
    // Never return 500 to Twilio. Always return TwiML.
    return twiml(
      buildConversationalTwiml("Sorry — something glitched. Say that again for me.")
    );
  }
}
