import "server-only";
import twilio from "twilio";

/**
 * Twilio outbound calling helper.
 * Returns null if Twilio is not configured.
 */

export async function startTwilioCall(to: string, note?: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;

  // ✅ Support BOTH variable names so nothing breaks
  const from =
    process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER;

  // ✅ New: voice URL we control, with fallback to the old TwiML Bin
  const voiceUrl =
    process.env.TWILIO_VOICE_URL ||
    "https://handler.twilio.com/twiml/EHe799022b06fd93132b819e795be155e3";

  // If any env vars missing → skip Twilio (fallback mode)
  if (!sid || !token || !from) {
    console.log("[twilio] Skipping real call (missing env vars)", {
      hasSid: !!sid,
      hasToken: !!token,
      hasFrom: !!from,
    });
    return null;
  }

  try {
    const client = twilio(sid, token);

    const call = await client.calls.create({
      to,
      from,
      url: voiceUrl,
      method: "POST",
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
