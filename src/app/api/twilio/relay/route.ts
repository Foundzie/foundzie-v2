// src/app/api/twilio/relay/route.ts
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

function norm(text: string) {
  return (text || "").toLowerCase().trim();
}

function isYes(text: string) {
  const t = norm(text);
  return (
    t === "yes" ||
    t === "yeah" ||
    t === "yep" ||
    t === "sure" ||
    t === "okay" ||
    t.includes("yes") ||
    t.includes("yeah") ||
    t.includes("sure") ||
    t.includes("okay")
  );
}

function isNo(text: string) {
  const t = norm(text);
  return t === "no" || t === "nope" || t === "nah" || t.includes("no") || t.includes("not really");
}

function maybeBrandLine(calleeType: "personal" | "business") {
  // ✅ Only business calls get the “Foundzie.com” mention
  if (calleeType === "business") {
    return `<Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">If you ever need us, you can find Foundzie at Foundzie dot com.</Say>`;
  }
  return ``;
}

/**
 * /api/twilio/relay?sid=<sessionId>&stage=start|confirm|reply&calleeType=personal|business
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sid = (url.searchParams.get("sid") || "").trim();
  const stage = (url.searchParams.get("stage") || "start").trim();

  const calleeTypeRaw = (url.searchParams.get("calleeType") || "").trim();
  const calleeType: "personal" | "business" = calleeTypeRaw === "business" ? "business" : "personal";

  const base = getBaseUrl();
  const session = sid ? await kvGetJSON<any>(relaySessionKey(sid)).catch(() => null) : null;

  const msg = String(session?.message || "").trim();
  const fromName = (process.env.FOUNDZIE_CALLER_NAME || "Kashif").trim();

  if (stage === "start") {
    const action = `${base}/api/twilio/relay?sid=${encodeURIComponent(sid)}&stage=confirm&calleeType=${encodeURIComponent(
      calleeType
    )}`;

    // ✅ Mark message as delivered (attempted) right away (deterministic)
    if (sid && session) {
      await kvSetJSON(relaySessionKey(sid), {
        ...session,
        calleeType: session?.calleeType || calleeType,
        status: "delivered_asked_for_reply",
        updatedAt: new Date().toISOString(),
      }).catch(() => null);
    }

    return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <!-- FOUNDZIE_RELAY_START sid=${escapeForXml(sid)} calleeType=${escapeForXml(calleeType)} -->
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">Hi — this is Foundzie calling on behalf of ${escapeForXml(
      fromName
    )}.</Say>
  <Pause length="1"/>
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">Here’s the message:</Say>
  <Pause length="1"/>
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">${escapeForXml(msg || "You have a message.")}</Say>
  <Pause length="1"/>
  <Gather input="speech" action="${escapeForXml(action)}" method="POST" timeout="7" speechTimeout="auto">
    <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">Would you like to send a reply back?</Say>
  </Gather>

  <!-- No speech: treat as "delivered_no_reply" -->
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">No worries — I won’t send a reply.</Say>
  ${maybeBrandLine(calleeType)}
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">Bye.</Say>
  <Hangup/>
</Response>`);
  }

  return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">Thanks. Bye.</Say>
  <Hangup/>
</Response>`);
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const sid = (url.searchParams.get("sid") || "").trim();
  const stage = (url.searchParams.get("stage") || "confirm").trim();

  const calleeTypeRaw = (url.searchParams.get("calleeType") || "").trim();
  const calleeType: "personal" | "business" = calleeTypeRaw === "business" ? "business" : "personal";

  const base = getBaseUrl();

  const form = await req.formData().catch(() => null);
  const speechRaw = form ? form.get("SpeechResult") : null;
  const speech = typeof speechRaw === "string" ? speechRaw.trim() : "";

  const session = sid ? await kvGetJSON<any>(relaySessionKey(sid)).catch(() => null) : null;

  if (!sid || !session) {
    return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">Thanks — bye.</Say>
  <Hangup/>
</Response>`);
  }

  const callerCallSid = String(session?.callerCallSid || "").trim();
  const roomId = String(session?.roomId || "").trim();

  if (stage === "confirm") {
    if (isYes(speech)) {
      const action = `${base}/api/twilio/relay?sid=${encodeURIComponent(sid)}&stage=reply&calleeType=${encodeURIComponent(
        calleeType
      )}`;

      await kvSetJSON(relaySessionKey(sid), {
        ...session,
        calleeType: session?.calleeType || calleeType,
        status: "delivered_confirmed_reply_intent",
        recipientConfirm: speech || null,
        updatedAt: new Date().toISOString(),
      }).catch(() => null);

      return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <!-- FOUNDZIE_RELAY_CONFIRM YES sid=${escapeForXml(sid)} -->
  <Gather input="speech" action="${escapeForXml(action)}" method="POST" timeout="10" speechTimeout="auto">
    <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">Okay — what should I tell them?</Say>
  </Gather>
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">No problem. I won’t send a reply.</Say>
  ${maybeBrandLine(calleeType)}
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">Bye.</Say>
  <Hangup/>
</Response>`);
    }

    const noReplyReason = isNo(speech) ? "They chose not to reply." : "They didn’t clearly confirm a reply.";

    await kvSetJSON(relaySessionKey(sid), {
      ...session,
      calleeType: session?.calleeType || calleeType,
      status: "delivered_no_reply",
      recipientConfirm: speech || null,
      updatedAt: new Date().toISOString(),
    }).catch(() => null);

    // ✅ Bring caller back immediately with deterministic outcome
    if (callerCallSid) {
      const callerSay = `Done — I delivered your message. ${noReplyReason}`;
      await redirectTwilioCall(
        callerCallSid,
        `${base}/api/twilio/voice?mode=message&say=${encodeURIComponent(callerSay)}${
          roomId ? `&roomId=${encodeURIComponent(roomId)}` : ""
        }`
      ).catch(() => null);
    }

    return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">Got it.</Say>
  ${maybeBrandLine(calleeType)}
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">Bye.</Say>
  <Hangup/>
</Response>`);
  }

  if (stage === "reply") {
    const replyText = (speech || "").slice(0, 360);

    await kvSetJSON(relaySessionKey(sid), {
      ...session,
      calleeType: session?.calleeType || calleeType,
      status: "delivered_with_reply",
      recipientReply: replyText || null,
      updatedAt: new Date().toISOString(),
    }).catch(() => null);

    if (callerCallSid) {
      const callerSay = replyText
        ? `Done — I delivered your message. They replied: ${replyText}`
        : `Done — I delivered your message. They tried to reply, but it didn’t come through clearly.`;

      await redirectTwilioCall(
        callerCallSid,
        `${base}/api/twilio/voice?mode=message&say=${encodeURIComponent(callerSay)}${
          roomId ? `&roomId=${encodeURIComponent(roomId)}` : ""
        }`
      ).catch(() => null);
    }

    return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">Perfect — I’ve got it.</Say>
  ${maybeBrandLine(calleeType)}
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">Bye.</Say>
  <Hangup/>
</Response>`);
  }

  return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">Thanks — bye.</Say>
  <Hangup/>
</Response>`);
}
