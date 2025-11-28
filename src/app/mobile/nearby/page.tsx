// src/app/mobile/nearby/page.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";

type Place = {
  id: string;
  name: string;
  category?: string;
  distanceMiles?: number;
};

type NewUserResponse = {
  ok?: boolean;
  item?: {
    id: string | number;
    name?: string;
    phone?: string | null;
  };
};

type CallResponse = {
  ok?: boolean;
  callId?: string;
  phone?: string;
  userId?: string | number | null;
  userName?: string | null;
  twilioStatus?: string | null;
};

export default function NearbyPage() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);

  // --- simple interest capture state (already planned) ---
  const [interest, setInterest] = useState("");
  const [savingInterest, setSavingInterest] = useState(false);
  const [interestSaved, setInterestSaved] = useState(false);
  const [interestError, setInterestError] = useState<string | null>(null);

  // --- NEW: concierge call mini-form state ---
  const [activePlaceId, setActivePlaceId] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [calling, setCalling] = useState(false);
  const [callMessage, setCallMessage] = useState<string | null>(null);
  const [callError, setCallError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/places");
        const json = await res.json();
        setPlaces((json.data ?? []) as Place[]);
      } catch (e) {
        console.error("Failed to load places", e);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const sorted = [...places].sort(
    (a, b) => (a.distanceMiles ?? 999) - (b.distanceMiles ?? 999)
  );

  // --- send interest -> /api/users/collect (M3 zero-friction bit) ---
  async function handleSaveInterest(e: FormEvent) {
    e.preventDefault();
    const trimmed = interest.trim();
    if (!trimmed) return;

    setSavingInterest(true);
    setInterestSaved(false);
    setInterestError(null);

    try {
      await fetch("/api/users/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interest: trimmed,
          source: "mobile-nearby",
          // store as real array so admin can target
          tags: [trimmed],
        }),
      });

      setInterestSaved(true);
    } catch (err) {
      console.error("Failed to save interest", err);
      setInterestError("Could not save interest. Please try again.");
    } finally {
      setSavingInterest(false);
    }
  }

  // --- NEW: “Book via concierge” -> create user + trigger call ---
  async function handleBookCall(e: FormEvent, place: Place) {
    e.preventDefault();
    const name = guestName.trim();
    const phone = guestPhone.trim();

    if (!name || !phone) {
      setCallError("Please enter your name and phone number.");
      return;
    }

    setCalling(true);
    setCallMessage(null);
    setCallError(null);

    try {
      // 1) Create / collect a lightweight user
      const collectRes = await fetch("/api/users/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          interest: `Book: ${place.name}`,
          source: "mobile-nearby-book",
          tags: [
            "booking-intent",
            place.category ?? "place",
            `place-id-${place.id}`,
          ],
        }),
      });

      const collectJson = (await collectRes
        .json()
        .catch(() => ({} as NewUserResponse))) as NewUserResponse;

      const newUserId =
        collectJson?.item?.id !== undefined
          ? String(collectJson.item.id)
          : undefined;

      // 2) Trigger outbound concierge call (Twilio / fallback)
      const note = `Booking request from mobile-nearby for "${place.name}"`;

      const callBody: any = {
        phone,
        note,
      };

      if (newUserId) {
        callBody.userId = newUserId;
      }

      const callRes = await fetch("/api/calls/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(callBody),
      });

      const callJson = (await callRes
        .json()
        .catch(() => ({} as CallResponse))) as CallResponse;

      if (!callRes.ok || !callJson.ok) {
        throw new Error(callJson?.callId || "Call request failed");
      }

      setCallMessage(
        `Got it, ${name}. Your concierge will call you shortly at ${phone}.`
      );
      // keep the form filled in case they want to tweak; just collapse it
      setActivePlaceId(null);
    } catch (err) {
      console.error("Failed to start concierge call", err);
      setCallError("Could not start the call. Please try again.");
    } finally {
      setCalling(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white pb-14">
      <header className="px-4 py-4 border-b border-slate-800">
        <h1 className="text-lg font-semibold">Nearby</h1>
        <p className="text-slate-400 text-sm">Places near your location</p>
      </header>

      {/* simple interest capture bar (zero-friction preference) */}
      <section className="px-4 py-3 border-b border-slate-800 space-y-2">
        <p className="text-xs text-slate-400">
          Tell Foundzie what you&apos;re into and we&apos;ll use it to improve
          suggestions.
        </p>

        <form onSubmit={handleSaveInterest} className="flex gap-2">
          <input
            value={interest}
            onChange={(e) => {
              setInterest(e.target.value);
              if (interestSaved) setInterestSaved(false);
              if (interestError) setInterestError(null);
            }}
            placeholder="e.g. brunch, nightlife"
            className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400"
          />
          <button
            type="submit"
            className="px-3 py-2 rounded-md bg-purple-600 text-xs font-medium disabled:opacity-60"
            disabled={savingInterest || interest.trim().length === 0}
          >
            {savingInterest ? "Saving..." : "Save"}
          </button>
        </form>

        {interestSaved && (
          <p className="text-[11px] text-emerald-400">
            Saved. We&apos;ll remember this for future recommendations.
          </p>
        )}
        {interestError && (
          <p className="text-[11px] text-red-400">{interestError}</p>
        )}

        {/* entry to concierge chat flow (existing) */}
        <div className="pt-1">
          <Link
            href="/mobile/concierge"
            className="text-[11px] text-purple-300 underline"
          >
            Prefer to talk to a concierge? Tap here.
          </Link>
        </div>
      </section>

      {loading ? (
        <p className="text-center py-8 text-slate-400">Loading...</p>
      ) : (
        <div className="px-4 pb-16 space-y-3">
          {sorted.map((p) => {
            const isActive = activePlaceId === String(p.id);
            return (
              <div
                key={p.id}
                className="border-b border-slate-800 py-3 space-y-2"
              >
                <Link
                  href={`/mobile/places/${p.id}`}
                  className="flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.category}</p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    {p.distanceMiles ?? "--"} mi
                    <div className="text-[11px] text-purple-300 underline mt-1">
                      View details
                    </div>
                  </div>
                </Link>

                {/* Book via concierge CTA */}
                <button
                  type="button"
                  onClick={() => {
                    setActivePlaceId((prev) =>
                      prev === String(p.id) ? null : String(p.id)
                    );
                    setCallMessage(null);
                    setCallError(null);
                  }}
                  className="text-[11px] text-emerald-300 underline"
                >
                  Book via concierge
                </button>

                {isActive && (
                  <form
                    onSubmit={(e) => handleBookCall(e, p)}
                    className="mt-2 space-y-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-3 text-[11px]"
                  >
                    <p className="text-slate-300 mb-1">
                      I&apos;ll call you to help with{" "}
                      <span className="font-semibold">{p.name}</span>. Share
                      your details:
                    </p>

                    <div className="flex flex-col gap-1">
                      <label className="text-slate-400">Name</label>
                      <input
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1.5 text-[11px] outline-none focus:border-emerald-500"
                        placeholder="e.g. Kashif"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-slate-400">Phone</label>
                      <input
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1.5 text-[11px] outline-none focus:border-emerald-500"
                        placeholder="+1 (312) 555-0000"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        We&apos;ll only use this so your concierge can call you.
                      </p>
                    </div>

                    {callError && (
                      <p className="text-[11px] text-red-400">{callError}</p>
                    )}
                    {callMessage && (
                      <p className="text-[11px] text-emerald-400">
                        {callMessage}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={calling}
                      className="mt-1 inline-flex items-center justify-center rounded-full bg-emerald-600 px-4 py-1.5 text-[11px] font-medium text-white disabled:opacity-60"
                    >
                      {calling ? "Starting call…" : "Call me about this"}
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-slate-950 border-t border-slate-800 flex justify-around py-2 text-xs text-slate-300">
        <Link href="/mobile">Home</Link>
        <Link href="/mobile/explore">Explore</Link>
        <Link href="/mobile/nearby" className="text-white">
          Nearby
        </Link>
        <Link href="/mobile/profile">Profile</Link>
        <Link href="/admin">Admin</Link>
      </nav>
    </main>
  );
}
