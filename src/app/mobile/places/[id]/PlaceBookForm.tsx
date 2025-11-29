"use client";

import { FormEvent, useState } from "react";

type PlaceBookFormProps = {
  placeId: string;
  placeName: string;
};

export default function PlaceBookForm({ placeId, placeName }: PlaceBookFormProps) {
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const name = firstName.trim();
    const phoneTrimmed = phone.trim();

    if (!name || !phoneTrimmed) {
      setError("Please add your name and phone so we can call you.");
      return;
    }

    setSaving(true);
    setError(null);
    setDoneMsg(null);

    try {
      // 1) Create / collect the user
      const collectRes = await fetch("/api/users/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone: phoneTrimmed,
          interest: `Book ${placeName}`,
          source: "mobile-place-book",
          // tags as a real array so admin can target these easily
          tags: [
            "booking-intent",
            `place-id-${placeId}`,
            `place-name-${placeName}`,
          ],
        }),
      });

      const collectJson = await collectRes.json().catch(() => ({} as any));

      if (!collectRes.ok || !collectJson?.item) {
        throw new Error(
          collectJson?.message || "Could not save your details. Please try again."
        );
      }

      const userId: string | undefined = collectJson.item.id;

      // 2) Start outbound call (Twilio will auto-skip if env vars missing)
      const note = `Booking request from mobile-place for "${placeName}"`;

      const callRes = await fetch("/api/calls/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId ?? undefined,
          phone: phoneTrimmed,
          note,
        }),
      });

      const callJson = await callRes.json().catch(() => ({} as any));

      if (!callRes.ok || !callJson?.ok) {
        throw new Error(
          callJson?.message ||
            "We saved your details but could not start the call. Please try again."
        );
      }

      setDoneMsg(
        `Got it, ${name}. Your concierge will call you shortly at ${phoneTrimmed}.`
      );
      setFirstName("");
      // Keep the phone visible so they know which number we’re calling
    } catch (err: any) {
      console.error("place booking failed", err);
      setError(
        err?.message ||
          "Something went wrong while starting your concierge call. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-4 border border-slate-800 rounded-xl p-4 bg-slate-900/60 space-y-2">
      <h2 className="text-sm font-semibold">Book via concierge</h2>
      <p className="text-xs text-slate-400">
        Share your details and Foundzie will call you to help book{" "}
        <span className="font-medium">{placeName}</span>.
      </p>

      <form onSubmit={handleSubmit} className="mt-2 space-y-2">
        <div className="flex gap-2">
          <input
            value={firstName}
            onChange={(e) => {
              setFirstName(e.target.value);
              if (error) setError(null);
              if (doneMsg) setDoneMsg(null);
            }}
            placeholder="Your name"
            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs outline-none focus:border-pink-500"
          />
          <input
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              if (error) setError(null);
              if (doneMsg) setDoneMsg(null);
            }}
            placeholder="+1 (312) 555-0000"
            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs outline-none focus:border-pink-500"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full mt-1 rounded-full bg-pink-600 text-xs font-medium py-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? "Starting your concierge call…" : "Book via concierge call"}
        </button>
      </form>

      {doneMsg && (
        <p className="text-[11px] text-emerald-400 mt-1">
          {doneMsg}
        </p>
      )}
      {error && (
        <p className="text-[11px] text-red-400 mt-1">
          {error}
        </p>
      )}

      <p className="text-[10px] text-slate-500 mt-1">
        Calls may start over the internet first and then use a normal phone call.
      </p>
    </section>
  );
}
