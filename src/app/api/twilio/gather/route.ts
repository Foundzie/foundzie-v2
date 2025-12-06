// src/app/api/twilio/gather/route.ts
import { NextRequest, NextResponse } from "next/server";
import { runFoundzieAgent } from "@/lib/agent/runtime";

export const dynamic = "force-dynamic";

// Simple XML-escaping to avoid breaking TwiML if the model
// replies with &, <, >, etc.
function escapeForXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildTwimlSay(message: string): string {
  const safe = escapeForXml(message.trim() || "");
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${safe}</Say>
</Response>`;
}

// Twilio will POST x-www-form-urlencoded with SpeechResult, From, etc.
export async function POST(req: NextRequest) {
  let speechText = "";

  try {
    const form = await req.formData();
    const raw = form.get("SpeechResult");
    if (typeof raw === "string") {
      speechText = raw.trim();
    }
  } catch (err) {
    console.error("[twilio/gather] Failed to parse formData:", err);
  }

  if (!speechText) {
    const fallback = buildTwimlSay(
      "I heard silence or couldn't understand the audio, " +
        "but your request has still been received. " +
        "Your concierge will review it and follow up from the app. " +
        "Thank you for using Foundzie."
    );
    return new NextResponse(fallback, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }

  console.log("[twilio/gather] SpeechResult:", speechText);

  let replyText =
    "Thanks, I got your request and will share it with your concierge team.";

  try {
    const agentResult = await runFoundzieAgent({
      input: speechText,
      source: "mobile", // phone user
      // toolsMode "off" so it just replies, no admin tools on phone
      toolsMode: "off",
    });

    if (agentResult.replyText && agentResult.replyText.trim()) {
      // Trim and lightly cap length so Twilio doesn't read an essay
      replyText = agentResult.replyText.trim().slice(0, 600);
    }
  } catch (err) {
    console.error("[twilio/gather] Agent error, using fallback:", err);
  }

  const twiml = buildTwimlSay(replyText);

  return new NextResponse(twiml, {
    status: 200,
    headers: {
      "Content-Type": "text/xml",
    },
  });
}

// Optional GET for quick sanity checks
export async function GET() {
  const sample = buildTwimlSay(
    "This is Foundzie's gather endpoint. " +
      "On a real call, I would reply with an AI-generated message here."
  );

  return new NextResponse(sample, {
    status: 200,
    headers: {
      "Content-Type": "text/xml",
    },
  });
}
