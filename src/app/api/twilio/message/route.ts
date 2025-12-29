// src/app/api/twilio/message/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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

function buildMessageTwiml(message: string) {
  const safe = escapeForXml((message || "").trim());
  const spoken = safe || "Hello. This is Foundzie with a quick message.";
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">${spoken}</Say>
  <Hangup/>
</Response>`;
}

// Twilio will request this URL during outbound calls.
// We accept GET and POST so it's robust.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const text = url.searchParams.get("text") || "";
  return twiml(buildMessageTwiml(text));
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const textFromQuery = url.searchParams.get("text") || "";

  // also allow Twilio form body param `text` if you ever choose to pass it that way
  const form = await req.formData().catch(() => null);
  const textFromForm = form ? form.get("text") : null;

  const text =
    textFromQuery ||
    (typeof textFromForm === "string" ? textFromForm : "") ||
    "";

  return twiml(buildMessageTwiml(text));
}
