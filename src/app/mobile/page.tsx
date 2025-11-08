"use client";

import { useState } from "react";
import Link from "next/link";
import { mockPlaces } from "@/app/data/places";
import { savedPlaceIds } from "@/app/data/saved";

type Place = (typeof mockPlaces)[number];

function PlaceRow({ place }: { place: Place }) {
  return (
    <Link
      href={`/mobile/places/${place.id}`}
      className="flex items-center justify-between py-3 border-b border-slate-800"
    >
      <div>
        <p className="font-medium">{place.name}</p>
        <p className="text-xs text-slate-400">{place.category}</p>
      </div>
      <div className="text-right text-xs text-slate-500 space-y-1">
        {place.distanceMiles ? <p>{place.distanceMiles} mi</p> : null}
        {place.openUntil ? <p>open until {place.openUntil}</p> : null}
      </div>
    </Link>
  );
}

export default function MobileHomePage() {
  const [activeTab, setActiveTab] = useState<"trending" | "nearby" | "saved">(
    "trending"
  );
  const [query, setQuery] = useState("");

  // base lists
  const trending = mockPlaces;
  const nearby = mockPlaces;
  const saved = mockPlaces.filter((p) => savedPlaceIds.includes(Number(p.id)));

  // pick list for the current tab
  let listToShow: Place[] = trending;
  if (activeTab === "nearby") listToShow = nearby;
  if (activeTab === "saved") listToShow = saved;

  // filter by search
  const filtered = listToShow.filter((place) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      place.name.toLowerCase().includes(q) ||
      place.category.toLowerCase().includes(q)
    );
  });

  return (
    <main className="min-h-screen bg-[#0f172a] text-white pb-14">
      {/* header */}
      <header className="px-4 pt-5 pb-3 space-y-2">
        <h1 className="text-lg font-semibold">Foundzie</h1>
        <p className="text-sm text-slate-300">What’s near you</p>

        {/* search */}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search nearby places..."
          className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400"
        />
      </header>

      {/* tabs */}
      <div className="px-4 flex gap-2 mb-2">
        <button
          onClick={() => setActiveTab("trending")}
          className={`px-3 py-1 rounded-full text-sm ${
            activeTab === "trending"
              ? "bg-fuchsia-500 text-white"
              : "bg-slate-800 text-slate-200"
          }`}
        >
          Trending
        </button>
        <button
          onClick={() => setActiveTab("nearby")}
          className={`px-3 py-1 rounded-full text-sm ${
            activeTab === "nearby"
              ? "bg-fuchsia-500 text-white"
              : "bg-slate-800 text-slate-200"
          }`}
        >
          Nearby
        </button>
        <button
          onClick={() => setActiveTab("saved")}
          className={`px-3 py-1 rounded-full text-sm ${
            activeTab === "saved"
              ? "bg-fuchsia-500 text-white"
              : "bg-slate-800 text-slate-200"
          }`}
        >
          Saved
        </button>
      </div>

      {/* list */}
      <div className="px-4 space-y-1">
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-400 py-6">No places match that.</p>
        ) : (
          filtered.map((place) => <PlaceRow key={place.id} place={place} />)
        )}
      </div>

      {/* bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0f172a] border-t border-slate-800 flex justify-around py-2 text-xs text-slate-300">
        <Link href="/mobile" className="text-white">
          Home
        </Link>
        <Link href="/mobile/explore">Explore</Link>
        <Link href="/mobile/notifications">Alerts</Link>
        <Link href="/mobile/profile">Profile</Link>
        <Link href="/admin">Admin</Link>
      </nav>
    </main>
  );
}