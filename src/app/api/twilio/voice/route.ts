// src/app/api/twilio/voice/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>
    Hi, this is Foundzie. We've received your request and your concierge is now reviewing it.
  </Say>
  <Pause length="1"/>
  <Say>
    If this was urgent or an SOS request, we will prioritise it right away.
    Thank you for using Foundzie.
  </Say>
</Response>`;

// Twilio will normally POST, but we also support GET so you can test in a browser.
export async function POST() {
  return new NextResponse(twiml, {
    status: 200,
    headers: {
      "Content-Type": "text/xml",
    },
  });
}

export async function GET() {
  return POST();
}
