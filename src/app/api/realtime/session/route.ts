// src/app/api/realtime/session/route.ts
import "server-only";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY; // make sure this matches your Vercel env var name

  if (!apiKey) {
    return NextResponse.json(
      { ok: false, message: "Missing OPENAI_API_KEY on server." },
      { status: 500 }
    );
  }

  const sdpOffer = await req.text().catch(() => "");
  if (!sdpOffer || sdpOffer.trim().length < 10) {
    return NextResponse.json(
      { ok: false, message: "Missing SDP offer body." },
      { status: 400 }
    );
  }

  // Session config must include session.type per Realtime docs.
  // Also: use output_modalities (not response.modalities).
  const sessionConfig = {
    type: "realtime",
    model: "gpt-realtime",
    output_modalities: ["audio", "text"],
    audio: {
      output: {
        voice: "marin",
      },
    },
  };

  const fd = new FormData();
  fd.set("sdp", sdpOffer);
  fd.set("session", JSON.stringify(sessionConfig));

  try {
    const r = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: fd,
    });

    const answerSdp = await r.text().catch(() => "");

    if (!r.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: "Realtime session creation failed.",
          status: r.status,
          detail: answerSdp?.slice(0, 1200) ?? null,
        },
        { status: 500 }
      );
    }

    // OpenAI may return a Location header with a call id
    const location = r.headers.get("Location") || "";
    const callId = location ? location.split("/").pop() : "";

    // IMPORTANT: ensure headers are always valid strings (fixes your build error)
    const headers = new Headers();
    headers.set("Content-Type", "application/sdp");
    headers.set("Cache-Control", "no-store");
    if (callId) headers.set("x-foundzie-realtime-call-id", callId);

    return new NextResponse(answerSdp, { status: 200, headers });
  } catch (err) {
    console.error("[/api/realtime/session] error:", err);
    return NextResponse.json(
      { ok: false, message: "Server error creating realtime session." },
      { status: 500 }
    );
  }
}

// Optional GET sanity check
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Realtime session endpoint is live. POST SDP offer to initialize.",
  });
}
