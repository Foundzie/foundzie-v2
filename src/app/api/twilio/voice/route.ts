// src/app/api/twilio/voice/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Initial TwiML: greet the caller and start a speech Gather.
// Twilio will POST the speech result to /api/twilio/gather.
const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech"
          action="/api/twilio/gather"
          method="POST"
          timeout="6">
    <Say>
      Hi, this is Foundzie, your personal concierge.
      After the beep, tell me what you need, then pause so I can respond.
    </Say>
  </Gather>
  <Say>
    I didn't catch anything this time, but your request has been received.
    Your concierge will review it and follow up from the app.
    Thank you for using Foundzie.
  </Say>
</Response>`;

export async function POST() {
  return new NextResponse(twiml, {
    status: 200,
    headers: {
      "Content-Type": "text/xml",
    },
  });
}

// Allow GET so you can test in the browser.
export async function GET() {
  return POST();
}
