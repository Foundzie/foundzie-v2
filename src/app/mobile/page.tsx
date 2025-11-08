"use client";

import { useState } from "react";
import Link from "next/link";
import { mockPlaces } from "@/app/data/places";
import savedPlaceIds from "@/app/data/saved";

// a Place is whatever shape our mockPlaces have
type Place = (typeof mockPlaces)[number];

export default function MobileHomePage() {
  // tabs: trending | nearby | saved
  const [activeTab, setActiveTab] = useState<"trending" | "nearby" | "saved">(
    "trending"
  );

  // 1) base lists
  const trending: Place[] = mockPlaces; // for now just show all
  const nearby: Place[] = mockPlaces; // later we can sort by distance

  // 2) turn saved IDs into real Place objects
  const saved: Place[] = mockPlaces.filter((place) =>
    savedPlaceIds.includes(Number(place.id))
  );

  // 3) pick which list to show
  let listToShow: Place[] = trending;
  if (activeTab === "nearby") listToShow = nearby;
  if (activeTab === "saved") listToShow = saved;

  return (
    <main className="min-h-screen bg-[#0f172a] text-white">
      {/* top bar */}
      <div className="flex items-center justify-between px-4 py-4">
        <h1 className="text-lg font-semibold">Foundzie</h1>
        <Link href="/mobile/notifications" className="text-sm text-purple-200">
          alerts
        </Link>
      </div>

      {/* tabs */}
      <div className="px-4 pb-4 flex gap-2">
        <button
          onClick={() => setActiveTab("trending")}
          className={`px-3 py-1 rounded-full text-sm ${
            activeTab === "trending"
              ? "bg-purple-500 text-white"
              : "bg-slate-700 text-slate-200"
          }`}
        >
          Trending
        </button>
        <button
          onClick={() => setActiveTab("nearby")}
          className={`px-3 py-1 rounded-full text-sm ${
            activeTab === "nearby"
              ? "bg-purple-500 text-white"
              : "bg-slate-700 text-slate-200"
          }`}
        >
          Nearby
        </button>
        <button
          onClick={() => setActiveTab("saved")}
          className={`px-3 py-1 rounded-full text-sm ${
            activeTab === "saved"
              ? "bg-purple-500 text-white"
              : "bg-slate-700 text-slate-200"
          }`}
        >
          Saved
        </button>
      </div>

      {/* list */}
      <div className="bg-slate-900/40 rounded-t-3xl pt-2 pb-10">
        {listToShow.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-300">
            Nothing saved yet. Go to Trending and tap a place to save it. (Mock
            for now.)
          </p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {listToShow.map((place) => (
              <li key={place.id}>
                <Link
                    href={`/mobile/places/${place.id}`}
                    className="flex items-center justify-between px-4 py-4 gap-3"
                  >
                  <div>
                    <p className="font-medium">{place.name}</p>
                    <p className="text-xs text-slate-300">{place.category}</p>
                  </div>
                  <div className="text-right text-xs text-slate-400 space-y-1">
                    {place.distanceMiles ? (
                      <p>{place.distanceMiles} mi</p>
                    ) : null}
                    {place.openUntil ? (
                      <p>open until {place.openUntil}</p>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}