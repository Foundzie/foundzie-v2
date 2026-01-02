import { NextRequest, NextResponse } from "next/server";

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

/**
 * GET /api/twilio/hold?sid=<sessionId>
 * Simple loop: short reassurance + pause + redirect back to itself.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sid = (url.searchParams.get("sid") || "").trim();

  const base = getBaseUrl();
  const self = `${base}/api/twilio/hold?sid=${encodeURIComponent(sid)}`;

  return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">One moment — I’m delivering your message now.</Say>
  <Pause length="15"/>
  <Redirect method="GET">${escapeForXml(self)}</Redirect>
</Response>`);
}

export async function POST(req: NextRequest) {
  // allow POST too (Twilio sometimes posts depending on redirect config)
  return GET(req);
}
