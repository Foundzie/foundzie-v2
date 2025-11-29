// src/lib/twilio.ts
import "server-only";
import twilio from "twilio";

/**
 * Twilio outbound calling helper.
 * Returns null if Twilio is not configured.
 */

export async function startTwilioCall(to: string, note?: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  // If any env vars missing → skip Twilio (fallback mode)
  if (!sid || !token || !from) {
    console.log("[twilio] Skipping real call (missing env vars)");
    return null;
  }

  try {
    const client = twilio(sid, token);

    const call = await client.calls.create({
      to,
      from,
      url: "https://handler.twilio.com/twiml/EHe799022b06fd93132b819e795be155e3", 
      // Replace with a TwiML Bin URL or optional webhook.
      // For now, a placeholder is fine.
    });

    console.log("[twilio] Created call:", call.sid);

    return {
      sid: call.sid,
      to,
      from,
      note: note ?? "",
    };
  } catch (err) {
    console.error("[twilio] Call failed:", err);
    return null; // Fallback gracefully
  }
}
