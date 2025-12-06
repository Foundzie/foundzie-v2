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

  // ✅ Our canonical voice URL (no more TwiML Bin fallback)
  const DEFAULT_VOICE_URL = "https://foundzie-v2.vercel.app/api/twilio/voice";

  // Use env if set, otherwise fall back to the stable project URL
  const voiceUrl =
    (process.env.TWILIO_VOICE_URL && process.env.TWILIO_VOICE_URL.trim()) ||
    DEFAULT_VOICE_URL;

  // If any env vars missing → skip Twilio (fallback mode)
  if (!sid || !token || !from) {
    console.log("[twilio] Skipping real call (missing env vars)", {
      hasSid: !!sid,
      hasToken: !!token,
      hasFrom: !!from,
    });
    return null;
  }

  console.log("[twilio] Using voiceUrl:", voiceUrl);

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
