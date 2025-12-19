// src/app/api/twilio/voice/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function twiml(xml: string) {
  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

function escapeXml(text: string) {
  return (text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getBaseUrl() {
  if (process.env.TWILIO_BASE_URL)
    return process.env.TWILIO_BASE_URL.replace(/\/+$/, "");

  if (process.env.VERCEL_URL)
    return `https://${process.env.VERCEL_URL}`;

  return "https://foundzie-v2.vercel.app";
}

export async function GET(req: Request) {
  return POST(req);
}

export async function POST(req: Request) {
  const wss = process.env.TWILIO_MEDIA_STREAM_WSS_URL?.trim();

  if (!wss) {
    return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Voice streaming is temporarily unavailable.</Say>
  <Hangup/>
</Response>`);
  }

  const url = new URL(req.url);
  const roomId = escapeXml(url.searchParams.get("roomId") || "");

  return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <!-- FOUNDZIE_STREAM_ONLY -->
  <Connect>
    <Stream url="${escapeXml(wss)}">
      ${roomId ? `<Parameter name="roomId" value="${roomId}" />` : ""}
      <Parameter name="source" value="twilio-media-streams" />
      <Parameter name="base" value="${escapeXml(getBaseUrl())}" />
    </Stream>
  </Connect>
</Response>`);
}
