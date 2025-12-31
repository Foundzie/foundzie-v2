import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function analyzeWss(wss: string) {
  const raw = (wss || "").trim();
  if (!raw) return { ok: false, reason: "missing" };

  let u: URL | null = null;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: "invalid-url" };
  }

  const isWss = u.protocol === "wss:";
  const hasPath = u.pathname === "/twilio/stream";

  return {
    ok: true,
    protocol: u.protocol,
    host: u.host,
    path: u.pathname,
    isWss,
    hasRequiredPath: hasPath,
    hint:
      !isWss
        ? "Must be wss:// not https://"
        : !hasPath
          ? "Must include /twilio/stream path (Fly bridge WS path)"
          : "Looks correct.",
  };
}

export async function GET() {
  const wss = (process.env.TWILIO_MEDIA_STREAM_WSS_URL || "").trim();
  const useStreams = (process.env.TWILIO_USE_MEDIA_STREAMS || "").trim();

  return NextResponse.json({
    now: new Date().toISOString(),
    vercelUrl: process.env.VERCEL_URL || null,
    useStreams,
    wssRawPresent: !!wss,
    wssAnalysis: analyzeWss(wss),
    note:
      !wss
        ? "WSS env missing in Vercel."
        : "If voice still shows Gather immediately, you're on an old deployment or Twilio is not hitting this route.",
  });
}
