"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";

type InteractionMode = "normal" | "child";

type Place = {
  id: string | number;
  name: string;
  category?: string;
  distanceMiles?: number;
};

type PlacesResponse = {
  success: boolean;
  source: "google" | "local" | "fallback-local" | "osm";
  count: number;
  places?: Place[];
  data?: Place[];
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

function pickPlaces(json: PlacesResponse): Place[] {
  if (Array.isArray(json.places)) return json.places;
  if (Array.isArray(json.data)) return json.data;
  return [];
}

const VISITOR_ID_STORAGE_KEY = "foundzie_visitor_id";

function createVisitorId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `visitor-${crypto.randomUUID()}`;
  }
  return `visitor-${Date.now().toString(16)}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

async function saveLocationToBackend(roomId: string, lat: number, lng: number, accuracy?: number) {
  try {
    await fetch("/api/location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId,
        lat,
        lng,
        accuracy: typeof accuracy === "number" ? accuracy : undefined,
        source: "browser",
      }),
    });
  } catch {
    // non-blocking
  }
}

export default function NearbyPage() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string>("");

  const [interactionMode] = useState<InteractionMode>(() => {
    if (typeof window === "undefined") return "normal";
    const stored = window.localStorage.getItem("foundzie:interaction-mode");
    return stored === "child" ? "child" : "normal";
  });

  const [interest, setInterest] = useState("");
  const [savingInterest, setSavingInterest] = useState(false);
  const [interestSaved, setInterestSaved] = useState(false);
  const [interestError, setInterestError] = useState<string | null>(null);

  const [activePlaceId, setActivePlaceId] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [calling, setCalling] = useState(false);
  const [callMessage, setCallMessage] = useState<string | null>(null);
  const [callError, setCallError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const modeParam = interactionMode === "child" ? "child" : "normal";

      async function fetchPlaces(url: string) {
        try {
          const res = await fetch(url, { cache: "no-store" });
          const json = (await res.json()) as PlacesResponse;
          if (!json.success) throw new Error("API returned success=false");
          if (cancelled) return;

          setPlaces(pickPlaces(json));
          setSource(json.source);
        } catch (err) {
          console.error("Failed to load places", err);
          if (!cancelled) setError("Could not load nearby places. Showing sample data.");
        } finally {
          if (!cancelled) setLoading(false);
        }
      }

      // ✅ Ensure visitor id exists
      let rid = "";
      if (typeof window !== "undefined") {
        rid = window.localStorage.getItem(VISITOR_ID_STORAGE_KEY) || "";
        if (!rid) {
          rid = createVisitorId();
          window.localStorage.setItem(VISITOR_ID_STORAGE_KEY, rid);
        }
      }

      if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;

            // ✅ M20: store location for voice/twilio context
            if (rid) {
              await saveLocationToBackend(rid, lat, lng, pos.coords.accuracy);
            }

            const url = `/api/places?lat=${lat}&lng=${lng}&mode=${modeParam}`;
            fetchPlaces(url);
          },
          () => fetchPlaces(`/api/places?mode=${modeParam}`),
          { timeout: 5000 }
        );
      } else {
        fetchPlaces(`/api/places?mode=${modeParam}`);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [interactionMode]);

  const sorted = [...places].sort(
    (a, b) => (a.distanceMiles ?? 999) - (b.distanceMiles ?? 999)
  );

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
      const collectRes = await fetch("/api/users/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          interest: `Book: ${place.name}`,
          source: "mobile-nearby-book",
          tags: ["booking-intent", place.category ?? "place", `place-id-${place.id}`],
        }),
      });

      const collectJson = (await collectRes.json().catch(() => ({}))) as NewUserResponse;

      const newUserId =
        collectJson?.item?.id !== undefined ? String(collectJson.item.id) : undefined;

      const note = `Booking request from mobile-nearby for "${place.name}"`;

      const callBody: any = { phone, note };
      if (newUserId) callBody.userId = newUserId;

      const callRes = await fetch("/api/calls/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(callBody),
      });

      const callJson = (await callRes.json().catch(() => ({}))) as CallResponse;

      if (!callRes.ok || !callJson.ok) {
        throw new Error(callJson?.callId || "Call request failed");
      }

      setCallMessage(`Got it, ${name}. Your concierge will call you shortly at ${phone}.`);
      setActivePlaceId(null);
    } catch (err) {
      console.error("Failed to start concierge call", err);
      setCallError("Could not start the call. Please try again.");
    } finally {
      setCalling(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-slate-900 pb-24">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="mx-auto max-w-md px-4 pt-4 pb-3">
          <h1 className="text-[18px] font-semibold tracking-tight">Nearby</h1>
          <p className="text-[12px] text-slate-600 mt-0.5">Places near your location</p>

          {source && (
            <p className="text-[11px] text-slate-500 mt-2">
              Data source:{" "}
              <span className="font-medium">
                {source === "google"
                  ? "Google Places"
                  : source === "osm"
                  ? "OpenStreetMap"
                  : "Local sample"}
              </span>
            </p>
          )}

          {interactionMode === "child" && (
            <p className="text-[11px] text-emerald-700 mt-1">
              Child-safe suggestions enabled for this device.
            </p>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 pt-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[12px] text-slate-600">
            Tell Foundzie what you&apos;re into and we&apos;ll use it to improve suggestions.
          </p>

          <form onSubmit={handleSaveInterest} className="mt-3 flex gap-2">
            <input
              value={interest}
              onChange={(e) => {
                setInterest(e.target.value);
                if (interestSaved) setInterestSaved(false);
                if (interestError) setInterestError(null);
              }}
              placeholder="e.g. brunch, nightlife"
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-slate-400"
            />
            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm active:scale-[0.99] disabled:opacity-60"
              disabled={savingInterest || interest.trim().length === 0}
            >
              {savingInterest ? "Saving…" : "Save"}
            </button>
          </form>

          {interestSaved && (
            <p className="mt-2 text-[11px] text-emerald-700">
              Saved. We&apos;ll remember this for future recommendations.
            </p>
          )}
          {interestError && <p className="mt-2 text-[11px] text-red-600">{interestError}</p>}

          <div className="mt-3">
            <Link href="/mobile/concierge" className="text-[12px] font-semibold text-blue-600">
              Prefer to talk to a concierge?
            </Link>
          </div>
        </section>

        <section className="mt-4">
          {loading ? (
            <p className="text-center py-10 text-slate-500 text-[13px]">Loading…</p>
          ) : (
            <>
              {error && (
                <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                  {error}
                </div>
              )}

              <div className="space-y-3">
                {sorted.map((p) => {
                  const isActive = activePlaceId === String(p.id);

                  return (
                    <div
                      key={String(p.id)}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <Link
                        href={`/mobile/places/${encodeURIComponent(String(p.id))}`}
                        className="flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold truncate">{p.name}</p>
                          <p className="mt-0.5 text-[12px] text-slate-600">
                            {p.category || "place"}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-[12px] text-slate-500">
                            {p.distanceMiles ?? "--"} mi
                          </p>
                          <p className="mt-1 text-[12px] font-semibold text-blue-600">
                            View details
                          </p>
                        </div>
                      </Link>

                      <button
                        type="button"
                        onClick={() => {
                          setActivePlaceId((prev) =>
                            prev === String(p.id) ? null : String(p.id)
                          );
                          setCallMessage(null);
                          setCallError(null);
                        }}
                        className="mt-3 text-[12px] font-semibold text-emerald-700"
                      >
                        Book via concierge
                      </button>

                      {isActive && (
                        <form
                          onSubmit={(e) => handleBookCall(e, p)}
                          className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-2"
                        >
                          <p className="text-[12px] text-slate-700">
                            I&apos;ll call you to help with{" "}
                            <span className="font-semibold">{p.name}</span>. Share your details:
                          </p>

                          <div className="grid grid-cols-1 gap-2">
                            <div className="flex flex-col gap-1">
                              <label className="text-[11px] text-slate-600">Name</label>
                              <input
                                value={guestName}
                                onChange={(e) => setGuestName(e.target.value)}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-emerald-400"
                                placeholder="e.g. Kashif"
                              />
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="text-[11px] text-slate-600">Phone</label>
                              <input
                                value={guestPhone}
                                onChange={(e) => setGuestPhone(e.target.value)}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-emerald-400"
                                placeholder="+1 (312) 555-0000"
                              />
                              <p className="text-[11px] text-slate-500">
                                We&apos;ll only use this so your concierge can call you.
                              </p>
                            </div>

                            {callError && <p className="text-[12px] text-red-600">{callError}</p>}
                            {callMessage && (
                              <p className="text-[12px] text-emerald-700">{callMessage}</p>
                            )}

                            <button
                              type="submit"
                              disabled={calling}
                              className="mt-1 inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm active:scale-[0.99] disabled:opacity-60"
                            >
                              {calling ? "Starting call…" : "Call me about this"}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
