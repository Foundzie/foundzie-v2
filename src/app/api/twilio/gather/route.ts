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
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildTwimlSay(message: string): string {
  const safe = escapeForXml(message.trim() || "");
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">
    ${safe}
  </Say>
  <Pause length="1"/>
  <Say voice="alice">
    If you need anything else, you can always open the Foundzie app and send me a message. Bye for now.
  </Say>
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
      "I heard silence or couldn't clearly understand you, " +
        "but your request has still been received and your concierge will review it. " +
        "Thank you for using Foundzie."
    );
    return new NextResponse(fallback, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }

  console.log("[twilio/gather] SpeechResult:", speechText);

  // 🔑 IMPORTANT: tell the agent this is ONE-SHOT phone audio.
  const phonePrompt =
    speechText +
    "\n\n[Voice call context: You get only this one short message from the user. " +
    "Give a complete, friendly answer in a few sentences. " +
    "Do NOT ask the user any questions back. " +
    "If you need missing details (like location), make a reasonable assumption and say it briefly.]";

  let replyText =
    "Thanks, I got your request and will share it with your concierge team.";

  try {
    const agentResult = await runFoundzieAgent({
      input: phonePrompt,
      source: "mobile", // phone user
      toolsMode: "off", // just talk, no admin tools
    });

    if (agentResult.replyText && agentResult.replyText.trim()) {
      // Trim and lightly cap length so Twilio doesn't read an essay
      replyText = agentResult.replyText.trim().slice(0, 450);
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
    "This is Foundzie's gather endpoint. On a real call, " +
      "I would reply with an AI-generated message here."
  );

  return new NextResponse(sample, {
    status: 200,
    headers: {
      "Content-Type": "text/xml",
    },
  });
}
