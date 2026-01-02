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

const FALLBACK_TTS_VOICE =
  (process.env.TWILIO_FALLBACK_VOICE || "").trim() || "Polly.Joanna-Neural";

function getBaseUrl(): string {
  const explicit = process.env.TWILIO_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const nextPublic = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (nextPublic) return nextPublic.replace(/\/+$/, "");

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl.replace(/\/+$/, "")}`;

  return "https://foundzie-v2.vercel.app";
}

function twiml(xml: string) {
  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

/**
 * GET/POST /api/twilio/hold?sid=<sessionId>
 * ✅ Plays hold music continuously (no repeated robotic reassurance loops)
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sid = (url.searchParams.get("sid") || "").trim();

  // You can set your own MP3 via env
  const holdMusic =
    (process.env.TWILIO_HOLD_MUSIC_URL || "").trim() ||
    // safe default (replace later with your preferred track)
    "https://files.freemusicarchive.org/storage-freemusicarchive-org/music/no_curator/Kevin_MacLeod/Classical_Sampler/Kevin_MacLeod_-_Gymnopedie_No_1.mp3";

  return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <!-- FOUNDZIE_HOLD sid=${escapeForXml(sid)} base=${escapeForXml(getBaseUrl())} -->
  <Say voice="${escapeForXml(FALLBACK_TTS_VOICE)}">One moment.</Say>
  <Play loop="0">${escapeForXml(holdMusic)}</Play>
</Response>`);
}

export async function POST(req: NextRequest) {
  return GET(req);
}
