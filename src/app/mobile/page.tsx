"use client";

import { useState } from "react";
import Link from "next/link";
import { mockPlaces } from "@/app/data/places";
import { savedPlaceIds } from "@/app/data/saved";

const TABS = ["Trending", "Nearby", "Saved"] as const;

export default function MobileHomePage() {
  const [activeTab, setActiveTab] =
    useState<(typeof TABS)[number]>("Trending");
  const [search, setSearch] = useState("");

  // 1) normalize saved ids because places use string ids like "1"
  const savedIdsAsString = savedPlaceIds.map((id) => String(id));

  // 2) start from search-filtered list
  const filtered = mockPlaces.filter((place) =>
    place.name.toLowerCase().includes(search.toLowerCase())
  );

  // 3) build the three tab lists from the filtered list
  const trendingList = filtered.filter((p) => p.trending);

  const nearbyList = filtered
    .slice()
    .sort((a, b) => a.distanceMiles - b.distanceMiles);

  const savedList = filtered.filter((p) =>
    savedIdsAsString.includes(p.id)
  );

  // 4) pick which one to show
  let listToShow = filtered;
  if (activeTab === "Trending") listToShow = trendingList;
  if (activeTab === "Nearby") listToShow = nearbyList;
  if (activeTab === "Saved") listToShow = savedList;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-4 py-4">
        <h1 className="text-lg font-semibold">Foundzie</h1>
        <p className="text-sm text-slate-400">What&apos;s near you</p>

        {/* search bar */}
        <div className="mt-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search nearby places..."
            className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm outline-none ring-1 ring-slate-800 focus:ring-pink-500"
          />
        </div>

        {/* tabs */}
        <div className="mt-4 flex gap-2">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-full px-4 py-1 text-sm transition ${
                activeTab === tab
                  ? "bg-pink-500 text-white"
                  : "bg-slate-900 text-slate-300"
              }`}
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
                  className="flex items-center justify-between rounded-md bg-slate-900 px-4 py-3 hover:bg-slate-800"
                >
                  <div>
                    <p className="text-sm font-medium">{place.name}</p>
                    <p className="text-xs text-slate-400">
                      {place.category}
                    </p>
                  </div>
                  <div className="text-right">
                    {/* this must match src/app/data/places.ts */}
                    <div className="text-xs text-slate-400">
                      {place.distanceMiles.toFixed(1)} mi
                    </div>
                    <div className="text-[10px] text-slate-500">
                      open until {place.openUntil}
                    </div>
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
