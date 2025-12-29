// src/lib/twilio.ts
import "server-only";
import twilio from "twilio";

/**
 * Twilio outbound calling helper.
 * Returns null if Twilio is not configured.
 *
 * Backwards compatible:
 *   startTwilioCall(to, note)
 *
 * New capabilities:
 *   - pass a custom TwiML URL (e.g. /api/twilio/message?text=...)
 *   - pass roomId for traceability
 */
export async function startTwilioCall(
  to: string,
  note?: string,
  opts?: {
    twimlUrl?: string; // override voiceUrl
    roomId?: string; // optional identity tag
  }
) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;

  // ✅ Support BOTH variable names so nothing breaks
  const from =
    process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER;

  // ✅ Canonical default voice URL
  const DEFAULT_VOICE_URL = "https://foundzie-v2.vercel.app/api/twilio/voice";

  // Use env if set, otherwise fall back to the stable project URL
  const baseVoiceUrl =
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

  // Decide which URL Twilio should request for TwiML
  const twimlUrl = (opts?.twimlUrl && opts.twimlUrl.trim()) || baseVoiceUrl;

  console.log("[twilio] Using TwiML url:", twimlUrl);

  try {
    const client = twilio(sid, token);

    const call = await client.calls.create({
      to,
      from,
      url: twimlUrl,
      method: "POST",
    });

    console.log("[twilio] Created call:", call.sid);

    return {
      sid: call.sid,
      to,
      from,
      note: note ?? "",
      roomId: opts?.roomId ?? "",
      twimlUrl,
    };
  } catch (err) {
    console.error("[twilio] Call failed:", err);
    return null; // Fallback gracefully
  }
}
