// src/app/api/realtime/session/route.ts
import "server-only";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * WebRTC SDP bridge (Unified Interface)
 * Browser POSTs SDP offer to THIS endpoint.
 * Server forwards it to OpenAI: POST https://api.openai.com/v1/realtime/calls
 * with multipart form fields: "sdp" + "session".
 *
 * Docs: Realtime API with WebRTC (Unified Interface). :contentReference[oaicite:1]{index=1}
 */

const DEFAULT_MODEL = process.env.REALTIME_MODEL?.trim() || "gpt-realtime";
const DEFAULT_VOICE = process.env.REALTIME_VOICE?.trim() || "marin";

function json(
  body: any,
  status = 200,
  extraHeaders?: Record<string, string>
) {
  return NextResponse.json(body, {
    status,
    headers: {
      ...(extraHeaders ?? {}),
    },
  });
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    return json(
      {
        ok: false,
        message:
          "Missing OPENAI_API_KEY on server. Add it to Vercel (Production/Preview) and redeploy.",
      },
      500
    );
  }

  // Accept either application/sdp or text/plain
  const contentType = req.headers.get("content-type") || "";
  if (
    !contentType.includes("application/sdp") &&
    !contentType.includes("text/plain") &&
    !contentType.includes("application/octet-stream")
  ) {
    // Not fatal, but helps catch weird proxying.
    console.warn("[/api/realtime/session] Unexpected content-type:", contentType);
  }

  const sdpOffer = await req.text().catch(() => "");
  if (!sdpOffer || sdpOffer.trim().length < 10) {
    return json({ ok: false, message: "Missing SDP offer body." }, 400);
  }

  // Session config goes into the multipart form under "session"
  // (Unified Interface) :contentReference[oaicite:2]{index=2}
  const sessionConfig = {
    type: "realtime",
    model: DEFAULT_MODEL,
    audio: {
      output: {
        voice: DEFAULT_VOICE,
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

    // Pull call id if present (Location header)
    const location = r.headers.get("Location") || "";
    const callId = location ? location.split("/").pop() : "";

    if (!r.ok) {
      // IMPORTANT: Return *useful* detail back to the browser UI.
      // Your voice page already tries to read JSON on failure.
      console.error("[/api/realtime/session] OpenAI error:", {
        status: r.status,
        callId,
        bodyPreview: raw?.slice(0, 1200),
      });

      return json(
        {
          ok: false,
          message: "Realtime session creation failed.",
          openaiStatus: r.status,
          callId: callId || null,
          // This is the key thing you need for debugging:
          detail: raw?.slice(0, 1200) || null,
          model: DEFAULT_MODEL,
          voice: DEFAULT_VOICE,
        },
        500,
        {
          "x-foundzie-realtime-call-id": callId || "",
        }
      );
    }

    // Success: return the SDP answer as application/sdp
    return new NextResponse(raw, {
      status: 200,
      headers: {
        "Content-Type": "application/sdp",
        "x-foundzie-realtime-call-id": callId || "",
      },
    });
  } catch (err: any) {
    console.error("[/api/realtime/session] server error:", err);
    return json(
      {
        ok: false,
        message: "Server error creating realtime session.",
        detail: typeof err?.message === "string" ? err.message : String(err),
        model: DEFAULT_MODEL,
        voice: DEFAULT_VOICE,
      },
      500
    );
  }
}

// Optional GET sanity check
export async function GET() {
  return json({
    ok: true,
    message:
      "Realtime session endpoint is live. POST SDP offer (application/sdp or text/plain) to initialize.",
    model: DEFAULT_MODEL,
    voice: DEFAULT_VOICE,
  });
}
