// src/app/api/realtime/session/route.ts
import "server-only";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Browser POSTs SDP offer (text/plain or application/sdp)
 * We forward it to OpenAI Realtime Create Call endpoint and return SDP answer.
 *
 * OpenAI API: POST https://api.openai.com/v1/realtime/calls
 * Requires multipart/form-data with:
 *  - sdp: <offer.sdp;type=application/sdp>
 *  - session: JSON;type=application/json
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

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

  // Session config for Realtime call (can be tuned later)
  const sessionConfig = {
    type: "realtime",
    model: "gpt-realtime",
    audio: {
      output: {
        voice: "marin",
      },
    },
  };

  // IMPORTANT:
  // OpenAI expects multipart parts with explicit content types
  const fd = new FormData();
  fd.set(
    "sdp",
    new Blob([sdpOffer], { type: "application/sdp" }),
    "offer.sdp"
  );
  fd.set(
    "session",
    new Blob([JSON.stringify(sessionConfig)], { type: "application/json" }),
    "session.json"
  );

  try {
    const r = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        // (Don’t set Content-Type manually for FormData; fetch will set boundary)
      },
      body: fd,
    });

    const bodyText = await r.text().catch(() => "");

    if (!r.ok) {
      // Log full details server-side; return safe detail to client
      console.error("[/api/realtime/session] OpenAI error:", {
        status: r.status,
        statusText: r.statusText,
        body: bodyText?.slice(0, 2000),
      });

      return NextResponse.json(
        {
          ok: false,
          message: "Realtime session creation failed.",
          status: r.status,
          detail: bodyText?.slice(0, 800) || null,
        },
        { status: 500 }
      );
    }

    // OpenAI returns 201 Created with SDP answer in body.
    const location = r.headers.get("Location") || "";
    const callId = location ? location.split("/").pop() : null;

    // Return SDP answer directly to the browser
    return new NextResponse(bodyText, {
      status: 200, // keep 200 for your client code path; body is the SDP answer
      headers: {
        "Content-Type": "application/sdp",
        "x-foundzie-realtime-call-id": callId ?? "",
      },
    });
  } catch (err) {
    console.error("[/api/realtime/session] fetch error:", err);
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
