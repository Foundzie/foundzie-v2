import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const wss = (process.env.TWILIO_MEDIA_STREAM_WSS_URL || "").trim();
  const useStreams = (process.env.TWILIO_USE_MEDIA_STREAMS || "").trim();

  return NextResponse.json({
    now: new Date().toISOString(),
    vercelUrl: process.env.VERCEL_URL || null,
    hasWss: !!wss,
    wssHost: wss ? (() => { try { return new URL(wss).host; } catch { return "invalid"; } })() : null,
    useStreams,
    note:
      !wss
        ? "WSS env missing in Vercel"
        : "WSS env present. If voice still shows Gather, you're on an old deployment/branch.",
  });
}
