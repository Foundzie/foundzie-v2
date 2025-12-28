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
          tags: ["booking-intent", `place-id-${placeId}`, `place-name-${placeName}`],
        }),
      });

      const collectJson = await collectRes.json().catch(() => ({} as any));

      if (!collectRes.ok || !collectJson?.item) {
        throw new Error(
          collectJson?.message || "Could not save your details. Please try again."
        );
      }

      const userId: string | undefined = collectJson.item.id;

      // 2) Start outbound call
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

      setDoneMsg(`Got it, ${name}. Your concierge will call you shortly at ${phoneTrimmed}.`);
      setFirstName("");
      // Keep phone visible
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
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
      <h2 className="text-[14px] font-semibold">Book via concierge</h2>
      <p className="text-[12px] text-slate-600">
        Share your details and Foundzie will call you to help book{" "}
        <span className="font-semibold">{placeName}</span>.
      </p>

      <form onSubmit={handleSubmit} className="mt-2 space-y-2">
        <div className="grid grid-cols-1 gap-2">
          <input
            value={firstName}
            onChange={(e) => {
              setFirstName(e.target.value);
              if (error) setError(null);
              if (doneMsg) setDoneMsg(null);
            }}
            placeholder="Your name"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-blue-400"
          />
          <input
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              if (error) setError(null);
              if (doneMsg) setDoneMsg(null);
            }}
            placeholder="+1 (312) 555-0000"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-blue-400"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-2xl bg-blue-600 py-3 text-[13px] font-semibold text-white shadow-sm active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? "Starting your concierge call…" : "Book via concierge call"}
        </button>
      </form>

      {doneMsg && <p className="text-[12px] text-emerald-700">{doneMsg}</p>}
      {error && <p className="text-[12px] text-red-600">{error}</p>}

      <p className="text-[11px] text-slate-500">
        Calls may start over the internet first and then use a normal phone call.
      </p>
    </section>
  );
}
