import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FALLBACK_TTS_VOICE =
  (process.env.TWILIO_FALLBACK_VOICE || "").trim() || "Polly.Joanna-Neural";

// If true, we skip the "Please hold..." line and just connect after message
const SKIP_HOLD_LINE = (process.env.TWILIO_SKIP_HOLD_LINE || "").trim() === "1";

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

/**
 * IMPORTANT: We ALWAYS deliver the message immediately.
 * No Gather gate, no redirect loops.
 */
function buildBridgeTwiml(confName: string, msg: string) {
  const safeConf = escapeForXml(confName || "foundzie-default");
  const safeMsg = escapeForXml((msg || "").trim());

  const greeting = "Hello. This is Foundzie calling with a quick message.";
  const spokenMsg = safeMsg || "Your caller asked me to pass along a message.";
  const holdLine = "Please hold one moment while I connect you.";

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">${escapeForXml(greeting)}</Say>
  <Pause length="1"/>
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">${spokenMsg}</Say>
  <Pause length="1"/>
  ${
    SKIP_HOLD_LINE
      ? ""
      : `<Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">${escapeForXml(holdLine)}</Say>
         <Pause length="1"/>`
  }
  <Dial>
    <Conference beep="false" startConferenceOnEnter="true" endConferenceOnExit="false">
      ${safeConf}
    </Conference>
  </Dial>
</Response>`;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const conf = (url.searchParams.get("conf") || "foundzie-default").trim();
  const text = url.searchParams.get("text") || "";
  return twiml(buildBridgeTwiml(conf, text));
}

export async function POST(req: NextRequest) {
  // Twilio may POST form data; also support querystring
  const url = new URL(req.url);
  const conf = (url.searchParams.get("conf") || "foundzie-default").trim();

  const textFromQuery = url.searchParams.get("text") || "";

  const form = await req.formData().catch(() => null);
  const textFromForm = form ? form.get("text") : null;

  const text =
    textFromQuery ||
    (typeof textFromForm === "string" ? textFromForm : "") ||
    "";

  return twiml(buildBridgeTwiml(conf, text));
}
