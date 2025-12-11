// src/app/mobile/explore/page.tsx
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
  data: Place[];
};

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
          const res = await fetch(url);
          const json = (await res.json()) as PlacesResponse;
          if (!json.success) {
            throw new Error("API returned success=false");
          }
          if (cancelled) return;
          setPlaces(json.data || []);
          setSource(json.source);
        } catch (err) {
          console.error("Failed to load places", err);
          if (!cancelled) {
            setError("Could not load places. Showing local sample data.");
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
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
          () => {
            fetchPlaces(`/api/places?mode=${modeParam}`);
          },
          {
            timeout: 5000,
          }
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
    return (
      p.name.toLowerCase().includes(q) ||
      (p.category || "").toLowerCase().includes(q)
    );
  });

  return (
    <main className="min-h-screen bg-slate-950 text-white pb-20">
      <header className="px-4 pt-4 pb-3 border-b border-slate-900 bg-gradient-to-b from-slate-900 to-slate-950">
        <h1 className="text-lg font-semibold tracking-tight">Explore</h1>
        <p className="text-sm text-slate-300">
          Browse places and ideas around you.
        </p>

        {source && (
          <p className="mt-1 text-[11px] text-slate-500">
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
          <p className="text-[11px] text-emerald-300 mt-0.5">
            Child-safe suggestions enabled on this device.
          </p>
        )}

        <div className="mt-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search places, coffee, brunch..."
            className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-slate-300"
          />
        </div>
      </header>

      {loading ? (
        <p className="text-center py-8 text-slate-400 text-sm">Loading...</p>
      ) : (
        <div className="px-4 mt-4 space-y-3">
          {error && (
            <p className="text-xs text-amber-300 mb-2 text-center">{error}</p>
          )}

          {filtered.length === 0 ? (
            <p className="text-center text-slate-400 py-6 text-sm">
              No matches found.
            </p>
          ) : (
            <div className="space-y-3">
              {filtered.map((p) => (
                <Link
                  key={p.id}
                  href={`/mobile/places/${p.id}`}
                  className="block rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 shadow-sm shadow-slate-950/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-[11px] text-slate-400">
                        {p.category}
                        {p.distanceMiles != null && (
                          <span className="ml-1 text-[11px] text-slate-500">
                            • {p.distanceMiles.toFixed(1)} mi
                          </span>
                        )}
                      </p>
                      {typeof p.rating === "number" && (
                        <p className="text-[11px] text-slate-400">
                          ★ {p.rating.toFixed(1)}{" "}
                          {typeof p.reviews === "number" && p.reviews > 0 && (
                            <span className="text-slate-500">
                              • {p.reviews} reviews
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    <span className="text-[11px] text-pink-400 underline">
                      View
                    </span>
                  </div>
                  {p.address && (
                    <p className="mt-1 text-[10px] text-slate-500 line-clamp-1">
                      {p.address}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
