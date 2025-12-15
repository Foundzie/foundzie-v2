// src/app/api/realtime/session/route.ts
import "server-only";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * SDP bridge for WebRTC:
 * Browser -> POST SDP offer -> Server forwards to OpenAI Realtime -> returns SDP answer
 *
 * Env options:
 * - OPENAI_API_KEY (required)
 * - REALTIME_MODEL (optional, default "gpt-realtime")
 * - REALTIME_VOICE (optional, default "alloy")
 *
 * Note: Realtime voice options change over time; "alloy" is a safe default per docs.
 */

function json(
  status: number,
  payload: Record<string, unknown>,
  extraHeaders?: Record<string, string>
) {
  return NextResponse.json(payload, { status, headers: extraHeaders });
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    return json(500, { ok: false, message: "Missing OPENAI_API_KEY on server." });
  }

  const sdpOffer = await req.text().catch(() => "");
  if (!sdpOffer || sdpOffer.trim().length < 10) {
    return json(400, { ok: false, message: "Missing SDP offer body." });
  }

  const model = (process.env.REALTIME_MODEL || "gpt-realtime").trim();
  const voice = (process.env.REALTIME_VOICE || "alloy").trim();

  // Realtime session config (sent in multipart form field "session")
  const sessionConfig = {
    type: "realtime",
    model,
    audio: {
      output: {
        voice,
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

    const raw = await r.text().catch(() => "");

    // Helpful headers for debugging (if present)
    const requestId =
      r.headers.get("x-request-id") ||
      r.headers.get("x-openai-request-id") ||
      "";
    const location = r.headers.get("Location") || "";
    const callId = location ? location.split("/").pop() : null;

    if (!r.ok) {
      // Try to parse OpenAI's JSON error if it is JSON
      let parsed: any = null;
      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch {
        parsed = null;
      }

      const openaiMessage =
        parsed?.error?.message ||
        parsed?.message ||
        null;

      return json(
        500,
        {
          ok: false,
          message: "Realtime session creation failed.",
          status: r.status,
          requestId: requestId || null,
          callId: callId || null,
          // Show OpenAI error message if available
          openaiMessage,
          // Include a short slice of raw response for debugging
          detail: raw ? raw.slice(0, 1200) : null,
          // Echo config so you can spot a bad voice/model instantly
          usedConfig: { model, voice },
        },
        requestId ? { "x-foundzie-openai-request-id": requestId } : undefined
      );
    }

    // Success: raw is SDP answer
    return new NextResponse(raw, {
      status: 200,
      headers: {
        "Content-Type": "application/sdp",
        "x-foundzie-realtime-call-id": callId ?? "",
        ...(requestId ? { "x-foundzie-openai-request-id": requestId } : {}),
      },
    });
  } catch (err: any) {
    const msg = typeof err?.message === "string" ? err.message : String(err);
    console.error("[/api/realtime/session] error:", err);

    return json(500, {
      ok: false,
      message: "Server error creating realtime session.",
      error: msg,
    });
  }
}

// Optional GET sanity check (also shows what config the server will use)
export async function GET() {
  const model = (process.env.REALTIME_MODEL || "gpt-realtime").trim();
  const voice = (process.env.REALTIME_VOICE || "alloy").trim();

  return NextResponse.json({
    ok: true,
    message: "Realtime session endpoint is live. POST SDP offer to initialize.",
    usedConfig: { model, voice },
    hasKey: !!process.env.OPENAI_API_KEY?.trim(),
  });
}
