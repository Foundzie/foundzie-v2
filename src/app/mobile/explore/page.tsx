"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type InteractionMode = "normal" | "child";

type Place = {
  id: number | string;
  name: string;
  category: string;
  distanceMiles?: number;
  rating?: number;
  reviews?: number;
  openUntil?: string;
  address?: string | null;
  source?: string;
};

type PlacesResponse = {
  success: boolean;
  source: "google" | "local" | "fallback-local" | "osm";
  count: number;
  places?: Place[];
  data?: Place[];
};

function pickPlaces(json: PlacesResponse): Place[] {
  if (Array.isArray(json.places)) return json.places;
  if (Array.isArray(json.data)) return json.data;
  return [];
}

export default function MobileExplorePage() {
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string>("");

  const [interactionMode] = useState<InteractionMode>(() => {
    if (typeof window === "undefined") return "normal";
    const stored = window.localStorage.getItem("foundzie:interaction-mode");
    return stored === "child" ? "child" : "normal";
  });

  useEffect(() => {
    let cancelled = false;

    async function loadPlaces() {
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
          if (!cancelled) setError("Could not load places. Showing local sample data.");
        } finally {
          if (!cancelled) setLoading(false);
        }
      }

      if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
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

    loadPlaces();
    return () => {
      cancelled = true;
    };
  }, [interactionMode]);

  const filtered = places.filter((p) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.category || "").toLowerCase().includes(q);
  });

  return (
    <main className="min-h-screen bg-white text-slate-900 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="mx-auto max-w-md px-4 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[18px] font-semibold tracking-tight">Explore</h1>
              <p className="text-[12px] text-slate-600 mt-0.5">
                Browse places and ideas around you.
              </p>
            </div>
          </div>

          {source && (
            <p className="mt-2 text-[11px] text-slate-500">
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
            <p className="mt-1 text-[11px] text-emerald-700">
              Child-safe suggestions enabled on this device.
            </p>
          )}

          <div className="mt-3">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search places, coffee, brunch..."
                className="w-full bg-transparent px-4 py-3 text-[13px] outline-none placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-md px-4 pt-4">
        {loading ? (
          <p className="text-center py-10 text-slate-500 text-[13px]">Loading…</p>
        ) : (
          <>
            {error && (
              <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                {error}
              </div>
            )}

            {filtered.length === 0 ? (
              <p className="text-center text-slate-500 py-10 text-[13px]">
                No matches found.
              </p>
            ) : (
              <div className="space-y-3">
                {filtered.map((p) => (
                  <Link
                    key={String(p.id)}
                    href={`/mobile/places/${encodeURIComponent(String(p.id))}`}
                    className="block"
                  >
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm active:scale-[0.99] transition">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold truncate">{p.name}</p>
                          <p className="mt-0.5 text-[12px] text-slate-600">
                            {p.category}
                            {p.distanceMiles != null && (
                              <span className="text-slate-400"> • {p.distanceMiles.toFixed(1)} mi</span>
                            )}
                          </p>

                          {typeof p.rating === "number" && (
                            <p className="mt-1 text-[12px] text-slate-600">
                              ★ {p.rating.toFixed(1)}
                              {typeof p.reviews === "number" && p.reviews > 0 && (
                                <span className="text-slate-400"> • {p.reviews} reviews</span>
                              )}
                            </p>
                          )}

                          {p.address && (
                            <p className="mt-1 text-[11px] text-slate-500 line-clamp-1">
                              {p.address}
                            </p>
                          )}
                        </div>

                        <span className="shrink-0 text-[12px] font-semibold text-blue-600">
                          View
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
