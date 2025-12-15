// src/app/api/realtime/session/route.ts
import "server-only";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Browser POSTs SDP offer (text/plain or application/sdp)
// We forward it to OpenAI Realtime and return SDP answer.
export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { ok: false, message: "Missing OPENAI_API_KEY on server." },
      { status: 500 }
    );
  }

  // Optional: passed from client so we can tag the realtime session (useful later)
  const roomId = req.headers.get("x-foundzie-room-id")?.trim() || "";

  const sdpOffer = await req.text().catch(() => "");
  if (!sdpOffer || sdpOffer.trim().length < 10) {
    return NextResponse.json(
      { ok: false, message: "Missing SDP offer body." },
      { status: 400 }
    );
  }

  // You can tune these later (voice, model, turn detection, etc.).
  const sessionConfig: any = {
    type: "realtime",
    model: "gpt-realtime",
    audio: {
      output: {
        voice: "marin",
      },
    },
    // Helpful for debugging/analytics later (safe no-op if OpenAI ignores it)
    ...(roomId ? { metadata: { roomId } } : {}),
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

    const answerSdp = await r.text();

    if (!r.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: "Realtime session creation failed.",
          status: r.status,
          detail: answerSdp?.slice(0, 500) ?? null,
        },
        { status: 500 }
      );
    }

    // OpenAI may return a Location header containing the call id
    const location = r.headers.get("Location") || "";
    const callId = location ? location.split("/").pop() : null;

    return new NextResponse(answerSdp, {
      status: 200,
      headers: {
        "Content-Type": "application/sdp",
        "x-foundzie-realtime-call-id": callId ?? "",
      },
    });
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
