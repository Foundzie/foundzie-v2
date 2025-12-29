// src/lib/twilio.ts
import "server-only";
import twilio from "twilio";

export type StartCallOpts = {
  /**
   * TwiML URL to use instead of default /api/twilio/voice
   * (we support both "voiceUrl" and "twimlUrl" to avoid breaking changes)
   */
  voiceUrl?: string;
  twimlUrl?: string;

  /**
   * Optional roomId; if provided and the chosen URL is the default /api/twilio/voice,
   * we can append ?roomId=... (non-breaking convenience).
   */
  roomId?: string;

  /** Optional note for logging/debug */
  note?: string;
};

/**
 * Twilio outbound calling helper.
 * Returns null if Twilio is not configured.
 *
 * Backward-compatible supported call forms:
 *  - startTwilioCall(to)
 *  - startTwilioCall(to, note)
 *  - startTwilioCall(to, opts)
 *  - startTwilioCall(to, note, opts)   ✅ (what your outbound route uses)
 */
export async function startTwilioCall(
  to: string,
  noteOrOpts?: string | StartCallOpts,
  maybeOpts?: StartCallOpts
) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;

  // Support BOTH variable names so nothing breaks
  const from = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER;

  const DEFAULT_VOICE_URL = "https://foundzie-v2.vercel.app/api/twilio/voice";

  // -----------------------------
  // Normalize arguments safely
  // -----------------------------
  let note = "";
  let opts: StartCallOpts = {};

  if (typeof noteOrOpts === "string") {
    note = noteOrOpts;
    opts = (maybeOpts ?? {}) as StartCallOpts;
  } else if (noteOrOpts && typeof noteOrOpts === "object") {
    opts = noteOrOpts as StartCallOpts;
    note = typeof opts.note === "string" ? opts.note : "";
  } else {
    opts = (maybeOpts ?? {}) as StartCallOpts;
    note = typeof opts.note === "string" ? opts.note : "";
  }

  // Accept either key
  const explicitUrl =
    (typeof opts.voiceUrl === "string" && opts.voiceUrl.trim()) ||
    (typeof opts.twimlUrl === "string" && opts.twimlUrl.trim()) ||
    "";

  // Env override (kept)
  const envVoiceUrl =
    (process.env.TWILIO_VOICE_URL && process.env.TWILIO_VOICE_URL.trim()) || "";

  let finalUrl = explicitUrl || envVoiceUrl || DEFAULT_VOICE_URL;

  // If using the default voice route and we have a roomId, append it (safe, non-breaking)
  try {
    const roomId =
      typeof opts.roomId === "string" && opts.roomId.trim() ? opts.roomId.trim() : "";
    if (roomId && finalUrl.includes("/api/twilio/voice") && !finalUrl.includes("roomId=")) {
      const u = new URL(finalUrl);
      u.searchParams.set("roomId", roomId);
      finalUrl = u.toString();
    }
  } catch {
    // If URL parsing fails, don't break calls
  }

  // If any env vars missing → skip Twilio (fallback mode)
  if (!sid || !token || !from) {
    console.log("[twilio] Skipping real call (missing env vars)", {
      hasSid: !!sid,
      hasToken: !!token,
      hasFrom: !!from,
    });
    return null;
  }

  console.log("[twilio] Using voiceUrl:", finalUrl);

  try {
    const client = twilio(sid, token);

    const call = await client.calls.create({
      to,
      from,
      url: finalUrl,
      method: "POST",
    });

    console.log("[twilio] Created call:", call.sid);

    return {
      sid: call.sid,
      to,
      from,
      note: note ?? "",
      voiceUrl: finalUrl,
    };
  } catch (err) {
    console.error("[twilio] Call failed:", err);
    return null; // Fallback gracefully
  }
}
