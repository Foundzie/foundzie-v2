// src/app/api/realtime/session/route.ts
import "server-only";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/realtime/session
 * Body: SDP offer (text/plain)
 * Returns: SDP answer (application/sdp)
 *
 * Uses OpenAI Realtime Create Call:
 * POST https://api.openai.com/v1/realtime/calls
 * multipart/form-data:
 *  - sdp: application/sdp
 *  - session: application/json
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || !apiKey.trim()) {
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

  // Session config (tweak voice/model later if needed)
  const sessionConfig = {
    type: "realtime",
    model: "gpt-realtime",
    audio: {
      output: {
        voice: "marin",
      },
    },
  };

  // IMPORTANT: set correct part content-types (OpenAI can be strict)
  const fd = new FormData();
  fd.set("sdp", new Blob([sdpOffer], { type: "application/sdp" }), "offer.sdp");
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
        // Do NOT manually set Content-Type for multipart; fetch will set boundary.
      },
      body: fd,
    });

    const responseText = await r.text();

    if (!r.ok) {
      // Send back enough detail so the client error is actionable
      return NextResponse.json(
        {
          ok: false,
          message: "Realtime session creation failed.",
          status: r.status,
          detail: responseText?.slice(0, 1200) ?? null,
        },
        { status: 500 }
      );
    }

    // Location header often contains the call id
    const location = r.headers.get("Location") || "";
    const callId = location ? location.split("/").pop() : null;

    // OpenAI returns SDP answer in the response body
    return new NextResponse(responseText, {
      status: 200,
      headers: {
        "Content-Type": "application/sdp",
        "x-foundzie-realtime-call-id": callId ?? "",
        "Cache-Control": "no-store",
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

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Realtime session endpoint is live. POST SDP offer to initialize.",
  });
}
