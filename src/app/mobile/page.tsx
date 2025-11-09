// src/app/mobile/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { mockPlaces } from "@/app/data/places";
import { savedPlaceIds } from "@/app/data/saved";

export default function MobileHomePage() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] =
    useState<"Trending" | "Nearby" | "Saved">("Trending");

  // 1) filter by search text
  const filtered = mockPlaces.filter((place) =>
    place.name.toLowerCase().includes(search.toLowerCase())
  );

  // 2) build the 3 views
  const trendingList = filtered.filter((p) => p.trending);

  // sort a copy by distanceMiles
  const nearbyList = [...filtered].sort(
    (a, b) => a.distanceMiles - b.distanceMiles
  );

  // saved: our savedPlaceIds are strings, so cast place.id to string
  const savedList = filtered.filter((p) =>
    savedPlaceIds.includes(p.id.toString())
  );

  // 3) decide which list to show
  let listToShow = filtered;
  if (activeTab === "Trending") listToShow = trendingList;
  if (activeTab === "Nearby") listToShow = nearbyList;
  if (activeTab === "Saved") listToShow = savedList;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-xl px-4 py-4">
        <h1 className="text-lg font-bold">Foundzie</h1>
        <p className="text-sm text-slate-400">What&apos;s near you</p>

        {/* search box */}
        <div className="mt-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search nearby places..."
            className="w-full rounded bg-slate-900 px-3 py-2 text-sm ring-1 ring-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
        </div>

        {/* tabs */}
        <div className="mt-4 flex gap-2">
          {["Trending", "Nearby", "Saved"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as "Trending" | "Nearby" | "Saved")}
              className={
                activeTab === tab
                  ? "px-3 py-1 rounded-full bg-pink-500 text-sm"
                  : "px-3 py-1 rounded-full bg-slate-900 text-sm text-slate-200"
              }
            >
              {tab}
            </button>
          ))}
        </div>

        {/* list */}
        <ul className="mt-6 space-y-3">
          {listToShow.length === 0 ? (
            <li className="text-sm text-slate-400">No places match.</li>
          ) : (
            listToShow.map((place) => (
              <li key={place.id}>
                <Link
                    href={`/mobile/places/${place.id}`}
                    className="flex items-center justify-between rounded-md bg-slate-900 px-3 py-3"
                  >
                  <div>
                    <p className="text-sm font-medium">{place.name}</p>
                    <p className="text-xs text-slate-400">{place.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">
                      {place.distanceMiles} mi
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
      </div>
    </main>
  );
}