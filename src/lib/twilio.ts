// src/lib/twilio.ts
import "server-only";
import twilio from "twilio";

type StartCallOpts = {
  /** TwiML URL to use instead of default /api/twilio/voice */
  voiceUrl?: string;
  /** Optional note for logging/debug */
  note?: string;
};

function getFromNumber(): string {
  return (
    process.env.TWILIO_PHONE_NUMBER ||
    process.env.TWILIO_FROM_NUMBER ||
    ""
  ).trim();
}

function getDefaultVoiceUrl(): string {
  return (
    process.env.TWILIO_VOICE_URL ||
    "https://foundzie-v2.vercel.app/api/twilio/voice"
  ).trim();
}

/**
 * Returns an authenticated Twilio client, or null if env vars missing.
 */
export function getTwilioClient() {
  const sid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
  const token = (process.env.TWILIO_AUTH_TOKEN || "").trim();
  if (!sid || !token) return null;
  return twilio(sid, token);
}

/**
 * Create an outbound call to `to` using TwiML URL `url`.
 * Returns { sid } or null if env vars missing / call failed.
 */
export async function createTwilioCall(to: string, url: string) {
  const client = getTwilioClient();
  const from = getFromNumber();

  if (!client || !from) {
    console.log("[twilio] Skipping create call (missing env vars)", {
      hasClient: !!client,
      hasFrom: !!from,
    });
    return null;
  }

  try {
    const call = await client.calls.create({
      to,
      from,
      url,
      method: "POST",
    });

    console.log("[twilio] Created call:", call.sid, "url:", url);
    return { sid: call.sid };
  } catch (err) {
    console.error("[twilio] createTwilioCall failed:", err);
    return null;
  }
}

/**
 * Redirect an *existing* active callSid to a new TwiML URL.
 * This is how we move the caller into a Conference mid-call.
 */
export async function redirectTwilioCall(callSid: string, url: string) {
  const client = getTwilioClient();
  if (!client) {
    console.log("[twilio] Skipping redirect (missing client)");
    return null;
  }

  const safeSid = (callSid || "").trim();
  if (!safeSid) return null;

  try {
    const updated = await client.calls(safeSid).update({
      url,
      method: "POST",
    });

    console.log("[twilio] Redirected call:", safeSid, "->", url);
    return { sid: updated.sid };
  } catch (err) {
    console.error("[twilio] redirectTwilioCall failed:", err);
    return null;
  }
}

/**
 * Backwards-compatible helper you already use.
 * Supports:
 *   startTwilioCall(phone, "note")
 *   startTwilioCall(phone, { voiceUrl, note })
 */
export async function startTwilioCall(
  to: string,
  noteOrOpts?: string | StartCallOpts
) {
  const opts: StartCallOpts =
    typeof noteOrOpts === "string"
      ? { note: noteOrOpts }
      : (noteOrOpts ?? {});

  const voiceUrl =
    (opts.voiceUrl && opts.voiceUrl.trim()) ||
    getDefaultVoiceUrl();

  // Keep old behavior: "skips" if missing env vars
  const result = await createTwilioCall(to, voiceUrl);
  if (!result) return null;

  return {
    sid: result.sid,
    to,
    from: getFromNumber(),
    note: opts.note ?? "",
    voiceUrl,
  };
}
