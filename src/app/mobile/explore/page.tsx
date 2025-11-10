"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function MobileExplorePage() {
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPlaces() {
      try {
        const res = await fetch("/api/places");
        const json = await res.json();
        setPlaces(json.data || []);
      } catch (e) {
        console.error("Failed to load places", e);
      } finally {
        setLoading(false);
      }
    }
    loadPlaces();
  }, []);

  const filtered = places.filter((p) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
  });

  return (
    <main className="min-h-screen bg-[#0f172a] text-white pb-14">
      <header className="px-4 pt-3 space-y-2">
        <h1 className="text-lg font-semibold">Explore</h1>
        <p className="text-sm text-slate-300">Browse all nearby places</p>
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
                  <p className="text-xs text-slate-400">{p.category}</p>
                </div>
                <span className="text-xs text-slate-500">View</span>
              </Link>
            ))
          )}
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-[#0f172a] border-t border-slate-800 flex justify-around py-2 text-xs text-slate-300">
        <Link href="/mobile">Home</Link>
        <Link href="/mobile/explore" className="text-white">Explore</Link>
        <Link href="/mobile/nearby">Nearby</Link>
        <Link href="/mobile/profile">Profile</Link>
        <Link href="/admin">Admin</Link>
      </nav>
    </main>
  );
}
