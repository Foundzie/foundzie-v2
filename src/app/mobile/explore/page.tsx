"use client";

import { useState } from "react";
import Link from "next/link";
import { mockPlaces } from "@/app/data/places";

export default function MobileExplorePage() {
  // what the user typed
  const [query, setQuery] = useState("");

  // filtered list
  const filtered = mockPlaces.filter((place) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      place.name.toLowerCase().includes(q) ||
      place.category.toLowerCase().includes(q)
    );
  });

  return (
    <main className="min-h-screen bg-[#0f172a] text-white pb-14">
      <header className="px-4 pt-5 pb-3 space-y-2">
        <h1 className="text-lg font-semibold">Explore</h1>
        <p className="text-sm text-slate-300">Browse all nearby places</p>

        {/* search */}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search places..."
          className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400"
        />
      </header>

      {/* categories (still fake) */}
      <div className="px-4 mb-4 grid grid-cols-3 gap-3">
        <div className="bg-slate-800 rounded-xl p-3 text-center">
          <p className="text-sm">Coffee</p>
          <p className="text-xs text-slate-400">24</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-3 text-center">
          <p className="text-sm">Parks</p>
          <p className="text-xs text-slate-400">18</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-3 text-center">
          <p className="text-sm">Workspaces</p>
          <p className="text-xs text-slate-400">6</p>
        </div>
      </div>

      {/* list */}
      <div className="px-4 space-y-1">
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-400 py-6">No places match that.</p>
        ) : (
          filtered.map((place) => (
            <Link
              key={place.id}
              href={`/mobile/places/${place.id}`}
              className="flex items-center justify-between py-3 border-b border-slate-800"
            >
              <div>
                <p className="font-medium">{place.name}</p>
                <p className="text-xs text-slate-400">{place.category}</p>
              </div>
              <div className="text-right text-xs text-slate-500">View</div>
            </Link>
          ))
        )}
      </div>

      {/* bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0f172a] border-t border-slate-800 flex justify-around py-2 text-xs text-slate-300">
        <Link href="/mobile">Home</Link>
        <Link href="/mobile/explore" className="text-white">
          Explore
        </Link>
        <Link href="/mobile/notifications">Alerts</Link>
        <Link href="/mobile/profile">Profile</Link>
        <Link href="/admin">Admin</Link>
      </nav>
    </main>
  );
}