// src/app/api/twilio/conference/bridge/route.ts
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

function buildBridgeTwiml(confName: string, msg: string) {
  const safeConf = escapeForXml(confName || "foundzie-default");
  const safeMsg = escapeForXml((msg || "").trim());

  const spoken =
    safeMsg || "Hello. This is Foundzie with a quick message for you.";

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">${spoken}</Say>
  <Dial>
    <Conference beep="false" startConferenceOnEnter="true" endConferenceOnExit="false">
      ${safeConf}
    </Conference>
  </Dial>
</Response>`;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const conf = (url.searchParams.get("conf") || "").trim();
  const text = url.searchParams.get("text") || "";
  return twiml(buildBridgeTwiml(conf || "foundzie-default", text));
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const conf = (url.searchParams.get("conf") || "").trim();

  const textFromQuery = url.searchParams.get("text") || "";

  const form = await req.formData().catch(() => null);
  const textFromForm = form ? form.get("text") : null;

  const text =
    textFromQuery ||
    (typeof textFromForm === "string" ? textFromForm : "") ||
    "";

  return twiml(buildBridgeTwiml(conf || "foundzie-default", text));
}
