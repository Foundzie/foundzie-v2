import { NextRequest, NextResponse } from "next/server";
import { kvGetJSON, kvSetJSON } from "@/lib/kv/redis";
import { redirectTwilioCall } from "@/lib/twilio";

export const dynamic = "force-dynamic";

function escapeForXml(text: string): string {
  return (text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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

const FALLBACK_TTS_VOICE =
  (process.env.TWILIO_FALLBACK_VOICE || "").trim() || "Polly.Joanna-Neural";

function twiml(xml: string) {
  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

function relaySessionKey(id: string) {
  return `foundzie:relay:${id}:v1`;
}

function isYes(text: string) {
  const t = (text || "").toLowerCase().trim();
  return (
    t === "yes" ||
    t === "yeah" ||
    t === "yep" ||
    t === "sure" ||
    t.includes("yes") ||
    t.includes("yeah") ||
    t.includes("sure") ||
    t.includes("okay")
  );
}

function isNo(text: string) {
  const t = (text || "").toLowerCase().trim();
  return t === "no" || t === "nope" || t.includes("no");
}

/**
 * GET /api/twilio/relay?sid=<sessionId>
 * POST called by <Gather> actions.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sid = (url.searchParams.get("sid") || "").trim();

  const session = sid ? await kvGetJSON<any>(relaySessionKey(sid)).catch(() => null) : null;
  const msg = String(session?.message || "").trim();

  const base = getBaseUrl();
  const action = `${base}/api/twilio/relay?sid=${encodeURIComponent(sid)}&stage=confirm`;

  // ✅ Conversational recipient experience
  return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">Hi — this is Foundzie calling with a quick message.</Say>
  <Pause length="1"/>
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">${escapeForXml(msg || "You have a message.")}</Say>
  <Pause length="1"/>
  <Gather input="speech" action="${escapeForXml(action)}" method="POST" timeout="6" speechTimeout="auto">
    <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">Do you want to reply back?</Say>
  </Gather>
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">No problem. I’ll pass that along.</Say>
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">Foundzie.com. Anything else I can help with?</Say>
  <Hangup/>
</Response>`);
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const sid = (url.searchParams.get("sid") || "").trim();
  const stage = (url.searchParams.get("stage") || "").trim() || "confirm";

  const base = getBaseUrl();

  const form = await req.formData().catch(() => null);
  const speechTextRaw = form ? form.get("SpeechResult") : null;
  const speech = typeof speechTextRaw === "string" ? speechTextRaw.trim() : "";

  const session = sid ? await kvGetJSON<any>(relaySessionKey(sid)).catch(() => null) : null;
  const callerCallSid = String(session?.callerCallSid || "").trim();
  const roomId = String(session?.roomId || "").trim();
  const originalMsg = String(session?.message || "").trim();

  // If session missing, just be graceful.
  if (!sid || !session || !callerCallSid) {
    return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">Thanks — I’ve got it.</Say>
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">Foundzie.com. Bye for now.</Say>
  <Hangup/>
</Response>`);
  }

  if (stage === "confirm") {
    // Did they want to reply?
    if (isYes(speech)) {
      const action = `${base}/api/twilio/relay?sid=${encodeURIComponent(sid)}&stage=reply`;
      return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${escapeForXml(action)}" method="POST" timeout="10" speechTimeout="auto">
    <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">Go ahead — what would you like me to tell them?</Say>
  </Gather>
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">No worries. I’ll pass along that you couldn’t talk right now.</Say>
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">Foundzie.com. Anything else I can help with?</Say>
  <Hangup/>
</Response>`);
    }

    // No / unclear => treat as no
    const resultText = isNo(speech) ? "They didn’t want to reply." : "I couldn’t clearly hear a reply.";
    const callerSay = `Delivered your message. ${resultText}`;

    await kvSetJSON(relaySessionKey(sid), {
      ...session,
      status: "delivered_no_reply",
      recipientConfirm: speech || null,
      updatedAt: new Date().toISOString(),
    }).catch(() => null);

    await redirectTwilioCall(
      callerCallSid,
      `${base}/api/twilio/voice?mode=message&say=${encodeURIComponent(callerSay)}${roomId ? `&roomId=${encodeURIComponent(roomId)}` : ""}`
    ).catch(() => null);

    return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">Got it — I’ll pass that along.</Say>
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">Foundzie.com. Anything else I can help with?</Say>
  <Hangup/>
</Response>`);
  }

  // stage === "reply"
  const replyText = (speech || "").slice(0, 300);
  const callerSay = replyText
    ? `Delivered your message. They replied: ${replyText}`
    : `Delivered your message. They tried to reply, but it didn’t come through clearly.`;

  await kvSetJSON(relaySessionKey(sid), {
    ...session,
    status: "delivered_with_reply",
    recipientReply: replyText || null,
    updatedAt: new Date().toISOString(),
  }).catch(() => null);

  await redirectTwilioCall(
    callerCallSid,
    `${base}/api/twilio/voice?mode=message&say=${encodeURIComponent(callerSay)}${roomId ? `&roomId=${encodeURIComponent(roomId)}` : ""}`
  ).catch(() => null);

  return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">Perfect — I’ll pass that along right now.</Say>
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">Foundzie.com. Anything else I can help with?</Say>
  <Hangup/>
</Response>`);
}
