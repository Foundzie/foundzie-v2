// src/app/mobile/page.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { mockPlaces } from "@/app/data/places";

const FILTERS = ["Trending", "Nearby", "Saved"] as const;
type Filter = (typeof FILTERS)[number];

export default function MobileHomePage() {
  const [activeFilter, setActiveFilter] = useState<Filter>("Trending");
  const [search, setSearch] = useState("");

  const filteredPlaces = useMemo(() => {
    let places = [...mockPlaces];

    // 1) apply tab filter first
    if (activeFilter === "Trending") {
      places = places.filter((p) => p.trending);
    } else if (activeFilter === "Nearby") {
      // we have distanceMiles in the data, so "nearby" = sort by distance
      places = places
        .filter((p) => typeof p.distanceMiles === "number")
        .sort((a, b) => a.distanceMiles - b.distanceMiles);
    } else if (activeFilter === "Saved") {
      // we don’t have real saved data yet, so show empty for now
      places = [];
    }

    // 2) apply search text
    const term = search.trim().toLowerCase();
    if (term.length > 0) {
      places = places.filter((p) => {
        return (
          p.name.toLowerCase().includes(term) ||
          p.category.toLowerCase().includes(term)
        );
      });
    }

    return places;
  }, [activeFilter, search]);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="px-4 pt-6 pb-4 space-y-4">
        <h1 className="text-xl font-semibold">Foundzie</h1>
        <p className="text-xs text-slate-400">What&apos;s near you</p>

        {/* search */}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search nearby places..."
          className="w-full rounded-md bg-slate-900 border border-slate-800 px-3 py-2 text-sm outline-none focus:border-slate-500"
        />

        {/* tabs */}
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={
                "px-3 py-1 rounded-full text-sm " +
                (activeFilter === f
                  ? "bg-pink-500 text-white"
                  : "bg-slate-900 text-slate-200")
              }
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* list */}
      <ul className="divide-y divide-slate-900">
        {filteredPlaces.length === 0 ? (
          <li className="px-4 py-6 text-sm text-slate-400">
            No places match that.
          </li>
        ) : (
          filteredPlaces.map((place) => (
            <li key={place.id}>
              <Link
                href={`/mobile/places/${place.id}`}
                className="flex items-center justify-between px-4 py-4 hover:bg-slate-900/40"
              >
                <div>
                  <p className="text-sm font-medium">{place.name}</p>
                  <p className="text-xs text-slate-400">{place.category}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">
                    {typeof place.distanceMiles === "number"
                      ? `${place.distanceMiles} mi`
                      : ""}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    open until {place.openUntil}
                  </p>
                </div>
              </Link>
            </li>
          ))
        )}
      </ul>
    </main>
  );
}