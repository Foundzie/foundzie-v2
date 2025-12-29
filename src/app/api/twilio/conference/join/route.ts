// src/app/api/twilio/conference/join/route.ts
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

function twiml(xml: string) {
  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const conf = (url.searchParams.get("conf") || "").trim();

  const confName = conf || "foundzie-default";

  return twiml(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference beep="false" startConferenceOnEnter="true" endConferenceOnExit="false">
      ${escapeForXml(confName)}
    </Conference>
  </Dial>
</Response>`);
}

export async function POST(req: NextRequest) {
  return GET(req);
}
