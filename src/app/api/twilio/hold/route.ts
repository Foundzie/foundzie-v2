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
 * GET/POST /api/twilio/hold?sid=<sessionId>
 * ✅ Safe "hold loop" that doesn't depend on unreliable external MP3s.
 * - Plays Twilio-hosted music (reliable)
 * - Loops using Redirect (no robotic repeated voice lines)
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sid = (url.searchParams.get("sid") || "").trim();

  const base = getBaseUrl();
  const self = `${base}/api/twilio/hold?sid=${encodeURIComponent(sid)}`;

  // ✅ Twilio-hosted reliable audio
  const holdMusic =
    (process.env.TWILIO_HOLD_MUSIC_URL || "").trim() ||
    "https://com.twilio.music.classical.s3.amazonaws.com/BusyStrings.mp3";

  return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <!-- FOUNDZIE_HOLD sid=${escapeForXml(sid)} -->
  <Play>${escapeForXml(holdMusic)}</Play>
  <Pause length="1"/>
  <Redirect method="GET">${escapeForXml(self)}</Redirect>
</Response>`);
}

export async function POST(req: NextRequest) {
  return GET(req);
}
