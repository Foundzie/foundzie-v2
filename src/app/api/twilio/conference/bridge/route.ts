import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FALLBACK_TTS_VOICE =
  (process.env.TWILIO_FALLBACK_VOICE || "").trim() || "Polly.Joanna-Neural";

// How long to wait for the callee to say “hello” before continuing automatically (seconds)
const GREETING_GATHER_TIMEOUT = Number(process.env.TWILIO_GATHER_TIMEOUT || 3);

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

function buildConnectTwiml(confName: string) {
  const safeConf = escapeForXml(confName || "foundzie-default");
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference beep="false" startConferenceOnEnter="true" endConferenceOnExit="false">
      ${safeConf}
    </Conference>
  </Dial>
</Response>`;
}

/**
 * Bridge TwiML:
 * 1) Greet
 * 2) Listen briefly (Gather) so the callee can say “hello”
 *    - If they speak or press a key -> /bridge?action=connect triggers immediate connect
 *    - If no input -> Twilio continues to /bridge?action=deliver to play message, then connect
 */
function buildBridgeTwiml(baseUrl: string, confName: string, msg: string) {
  const safeConf = escapeForXml(confName || "foundzie-default");
  const safeMsg = escapeForXml((msg || "").trim());

  const greeting = "Hello! This is Foundzie.";
  const spokenMsg =
    safeMsg || "Your caller asked me to pass along a message.";

  const actionConnect =
    `${baseUrl}/api/twilio/conference/bridge` +
    `?action=connect&conf=${encodeURIComponent(confName || "foundzie-default")}`;

  const actionDeliver =
    `${baseUrl}/api/twilio/conference/bridge` +
    `?action=deliver&conf=${encodeURIComponent(confName || "foundzie-default")}` +
    `&text=${encodeURIComponent(msg || "")}`;

  // NOTE:
  // - input="speech dtmf" lets “hello” (speech) or keypad press interrupt and connect.
  // - timeout is seconds of silence to wait before firing action.
  // - If no input, Twilio continues after <Gather> to <Redirect actionDeliver>.
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">${escapeForXml(greeting)}</Say>

  <Gather
    input="speech dtmf"
    action="${escapeForXml(actionConnect)}"
    method="POST"
    timeout="${Math.max(1, Math.min(10, GREETING_GATHER_TIMEOUT))}"
    speechTimeout="auto"
    enhanced="true"
  >
    <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">Hi there — take a second to say hello.</Say>
  </Gather>

  <Redirect method="POST">${escapeForXml(actionDeliver)}</Redirect>
</Response>`;
}

function buildDeliverTwiml(confName: string, msg: string) {
  const safeConf = escapeForXml(confName || "foundzie-default");
  const safeMsg = escapeForXml((msg || "").trim());

  const spokenMsg =
    safeMsg || "Your caller asked me to pass along a message.";

  const holdLine = "Please hold one moment while I connect you.";

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
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

function getBaseUrl(req: NextRequest): string {
  // Prefer env if provided (recommended for Twilio webhooks)
  const explicit = (process.env.TWILIO_BASE_URL || "").trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  // Otherwise derive from request host
  const host = req.headers.get("host") || "foundzie-v2.vercel.app";
  const proto = req.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`.replace(/\/+$/, "");
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const action = (url.searchParams.get("action") || "").trim();
  const conf = (url.searchParams.get("conf") || "foundzie-default").trim();
  const text = url.searchParams.get("text") || "";

  // If Twilio hits GET (rare), behave sensibly
  if (action === "connect") return twiml(buildConnectTwiml(conf));
  if (action === "deliver") return twiml(buildDeliverTwiml(conf, text));

  const base = getBaseUrl(req);
  return twiml(buildBridgeTwiml(base, conf, text));
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const action = (url.searchParams.get("action") || "").trim();
  const conf = (url.searchParams.get("conf") || "foundzie-default").trim();

  // Twilio Gather hits action=connect here if any speech/dtmf is detected
  if (action === "connect") {
    return twiml(buildConnectTwiml(conf));
  }

  // deliver path (Redirect hits this)
  if (action === "deliver") {
    const textFromQuery = url.searchParams.get("text") || "";

    const form = await req.formData().catch(() => null);
    const textFromForm = form ? form.get("text") : null;

    const text =
      textFromQuery ||
      (typeof textFromForm === "string" ? textFromForm : "") ||
      "";

    return twiml(buildDeliverTwiml(conf, text));
  }

  // Default POST: same as GET default
  const textFromQuery = url.searchParams.get("text") || "";
  const form = await req.formData().catch(() => null);
  const textFromForm = form ? form.get("text") : null;

  const text =
    textFromQuery ||
    (typeof textFromForm === "string" ? textFromForm : "") ||
    "";

  const base = getBaseUrl(req);
  return twiml(buildBridgeTwiml(base, conf, text));
}
