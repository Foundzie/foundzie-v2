// src/app/mobile/explore/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
  source: "google" | "local" | "fallback-local";
  count: number;
  data: Place[];
};

export default function MobileExplorePage() {
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function loadPlaces() {
      setLoading(true);
      setError(null);

      // helper that actually calls the API
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

      // Try geolocation first
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const url = `/api/places?lat=${lat}&lng=${lng}`;
            fetchPlaces(url);
          },
          () => {
            // Permission denied or failed → fallback to generic list
            fetchPlaces("/api/places");
          },
          {
            timeout: 5000,
          }
        );
      } else {
        // No geolocation in this environment
        fetchPlaces("/api/places");
      }
    }

    loadPlaces();

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = places.filter((p) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.category || "").toLowerCase().includes(q)
    );
  });

  return (
    <main className="min-h-screen bg-[#0f172a] text-white pb-14">
      <header className="px-4 pt-3 space-y-2">
        <h1 className="text-lg font-semibold">Explore</h1>
        <p className="text-sm text-slate-300">
          Browse places and ideas around you.
        </p>

        {source && (
          <p className="text-[11px] text-slate-500">
            Data source:{" "}
            <span className="font-medium">
              {source === "google" ? "Google Places" : "Local sample"}
            </span>
          </p>
        )}

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search places..."
          className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400"
        />
      </header>

      {loading ? (
        <p className="text-center py-8 text-slate-400">Loading...</p>
      ) : (
        <div className="px-4 mt-4 space-y-3">
          {error && (
            <p className="text-xs text-amber-300 mb-2 text-center">{error}</p>
          )}

          {filtered.length === 0 ? (
            <p className="text-center text-slate-400 py-6">No matches found.</p>
          ) : (
            filtered.map((p) => (
              <Link
                key={p.id}
                href={`/mobile/places/${p.id}`}
                className="flex items-center justify-between border-b border-slate-800 py-3"
              >
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-slate-400">
                    {p.category}
                    {p.distanceMiles != null && (
                      <span className="ml-1 text-[11px] text-slate-500">
                        • {p.distanceMiles.toFixed(1)} mi
                      </span>
                    )}
                  </p>
                </div>
                <span className="text-xs text-slate-500">View</span>
              </Link>
            ))
          )}
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-[#0f172a] border-t border-slate-800 flex justify-around py-2 text-xs text-slate-300">
        <Link href="/mobile">Home</Link>
        <Link href="/mobile/explore" className="text-white">
          Explore
        </Link>
        <Link href="/mobile/nearby">Nearby</Link>
        <Link href="/mobile/profile">Profile</Link>
        <Link href="/admin">Admin</Link>
      </nav>
    </main>
  );
}
