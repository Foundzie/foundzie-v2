// src/app/api/twilio/voice/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function twiml(xml: string) {
  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

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

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl.replace(/\/+$/, "")}`;

  const nextPublic = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (nextPublic) return nextPublic.replace(/\/+$/, "");

  return "https://foundzie-v2.vercel.app"; // safe fallback
}

/**
 * IMPORTANT:
 * Return ONLY the *inside* of <Response> ... </Response>
 * (No XML header, no outer <Response>.)
 */
function gatherBody(marker: string) {
  const base = getBaseUrl();
  const gatherUrl = `${base}/api/twilio/gather`;
  const voiceUrl = `${base}/api/twilio/voice`;

  return `
  <!-- FOUNDZIE_VOICE_MARKER ${escapeForXml(marker)} -->
  <Gather input="speech" action="${escapeForXml(gatherUrl)}" method="POST" timeout="7" speechTimeout="auto">
    <Say voice="alice">Hi, this is Foundzie. Tell me what you need help with.</Say>
  </Gather>
  <Say voice="alice">I did not hear anything. Let us try again.</Say>
  <Redirect method="POST">${escapeForXml(voiceUrl)}</Redirect>
`.trim();
}

function buildVoiceTwiml(req: Request, marker: string) {
  const wss = (process.env.TWILIO_MEDIA_STREAM_WSS_URL || "").trim();
  const base = getBaseUrl();

  // If no WSS configured → go straight to Gather
  if (!wss) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
${gatherBody(marker + " mode=GATHER_ONLY wss=EMPTY")}
</Response>`;
  }

  const url = new URL(req.url);
  const roomId = (url.searchParams.get("roomId") || "").trim();
  const safeRoom = escapeForXml(roomId);

  const streamBlock = `
  <!-- FOUNDZIE_VOICE_MARKER ${escapeForXml(marker)} -->
  <Connect>
    <Stream url="${escapeForXml(wss)}">
      ${safeRoom ? `<Parameter name="roomId" value="${safeRoom}" />` : ``}
      <Parameter name="source" value="twilio-media-stream" />
      <Parameter name="base" value="${escapeForXml(base)}" />
    </Stream>
  </Connect>
`.trim();

  // IMPORTANT: still only one <Response>. Gather is fallback after stream ends.
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
${streamBlock}

${gatherBody(marker + " fallback=gather")}
</Response>`;
}

export async function GET(req: Request) {
  return POST(req);
}

export async function POST(req: Request) {
  const sha =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_GITHUB_COMMIT_SHA ||
    "sha-unknown";

  const wssPresent = !!(process.env.TWILIO_MEDIA_STREAM_WSS_URL || "").trim();
  const marker = `mode=STREAM sha=${sha} wssPresent=${wssPresent}`;

  return twiml(buildVoiceTwiml(req, marker));
}
