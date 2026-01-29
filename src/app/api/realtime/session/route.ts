// src/app/api/realtime/session/route.ts
import "server-only";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function json(body: any, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(body, { status, headers });
}

function getApiKey() {
  return (
    process.env.OPENAI_API_KEY?.trim() ||
    (process.env.OPENAI_KEY?.trim() as string | undefined) ||
    ""
  );
}

function pickVoice() {
  // Keep ONE voice across WebRTC + Twilio bridge
  // Bridge defaults to marin, so WebRTC must match.
  return process.env.REALTIME_VOICE?.trim() || "marin";
}

function pickModel() {
  return process.env.REALTIME_MODEL?.trim() || "gpt-realtime";
}

function looksLikeSdp(text: string) {
  const t = (text || "").trim();
  if (t.length < 10) return false;
  return (
    t.includes("v=0") &&
    (t.includes("o=") || t.includes("s=") || t.includes("t="))
  );
}

export async function GET() {
  const apiKey = getApiKey();
  return json({
    ok: true,
    message:
      "Realtime session endpoint is live. POST SDP offer (Content-Type: text/plain or application/sdp).",
    env: {
      hasOpenAIKey: Boolean(apiKey),
      model: pickModel(),
      voice: pickVoice(),
    },
  });
}

export async function POST(req: NextRequest) {
  const apiKey = getApiKey();
  if (!apiKey)
    return json({ ok: false, message: "Missing OPENAI_API_KEY on server." }, 500);

  const sdpOffer = await req.text().catch(() => "");
  if (!looksLikeSdp(sdpOffer)) {
    return json(
      {
        ok: false,
        message:
          "Missing/invalid SDP offer body. Make sure you POST raw offer.sdp.",
      },
      400
    );
  }

  const sessionConfig = {
    type: "realtime",
    model: pickModel(),
    audio: {
      output: { voice: pickVoice() },
    },
  };

  const fd = new FormData();
  fd.set("sdp", sdpOffer);
  fd.set("session", JSON.stringify(sessionConfig));

  try {
    const r = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: fd,
    });

    const text = await r.text().catch(() => "");

    if (!r.ok) {
      return json(
        {
          ok: false,
          message: "Realtime session creation failed.",
          status: r.status,
          detail: text?.slice(0, 2000) || null,
          hint: "Most common causes: invalid voice/model name, missing key, or bad SDP.",
        },
        500
      );
    }

    const location = r.headers.get("Location") || "";
    const callId = location ? location.split("/").pop() : "";

    const headers = new Headers();
    headers.set("Content-Type", "application/sdp");
    headers.set("Cache-Control", "no-store");
    if (callId) headers.set("x-foundzie-realtime-call-id", callId);

    return new NextResponse(text, { status: 200, headers });
  } catch (err) {
    console.error("[/api/realtime/session] error:", err);
    return json(
      { ok: false, message: "Server error creating realtime session." },
      500
    );
  }
}
