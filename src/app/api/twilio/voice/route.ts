// src/app/api/twilio/voice/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * We strongly prefer absolute URLs for Twilio <Gather action> and <Redirect>.
 * Set ONE of these env vars (recommended):
 * - TWILIO_BASE_URL="https://your-app.vercel.app"
 *
 * Optional:
 * - TWILIO_VOICE_URL="https://your-app.vercel.app/api/twilio/voice"
 */
function getBaseUrl(): string | null {
  const explicit = process.env.TWILIO_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const voiceUrl = process.env.TWILIO_VOICE_URL?.trim();
  if (voiceUrl) {
    try {
      const u = new URL(voiceUrl);
      return `${u.protocol}//${u.host}`;
    } catch {
      // ignore
    }
  }

  const nextPublic = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (nextPublic) return nextPublic.replace(/\/+$/, "");

  // Vercel provides this without protocol
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl.replace(/\/+$/, "")}`;

  return null;
}

function twiml(xml: string) {
  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

export async function GET() {
  return POST();
}

export async function POST() {
  const base = getBaseUrl();

  // If we can't build absolute URLs, fall back to relative paths (still works often),
  // but absolute is more reliable for Twilio.
  const gatherUrl = base ? `${base}/api/twilio/gather` : `/api/twilio/gather`;
  const voiceUrl = base ? `${base}/api/twilio/voice` : `/api/twilio/voice`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather
    input="speech"
    action="${gatherUrl}"
    method="POST"
    timeout="7"
    speechTimeout="auto"
  >
    <Say voice="alice">
      Hi, this is Foundzie, your personal concierge.
      Tell me what you need, and I will help you right now.
    </Say>
  </Gather>

  <Say voice="alice">
    I did not hear anything. Let’s try again.
  </Say>
  <Redirect method="POST">${voiceUrl}</Redirect>
</Response>`;

  return twiml(xml);
}
