"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function NearbyPage() {
  const [places, setPlaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
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
    load();
  }, []);

  const sorted = [...places].sort((a, b) => (a.distanceMiles ?? 999) - (b.distanceMiles ?? 999));

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="px-4 py-4 border-b border-slate-800">
        <h1 className="text-lg font-semibold">Nearby</h1>
        <p className="text-slate-400 text-sm">Places near your location</p>
      </header>

      {loading ? (
        <p className="text-center py-8 text-slate-400">Loading...</p>
      ) : (
        <div className="px-4 pb-16 space-y-2">
          {sorted.map((p) => (
            <Link
              key={p.id}
              href={`/mobile/places/${p.id}`}
              className="flex items-center justify-between border-b border-slate-800 py-3"
            >
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-slate-400">{p.category}</p>
              </div>
              <p className="text-xs text-slate-500">{p.distanceMiles} mi</p>
            </Link>
          ))}
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-slate-950 border-t border-slate-800 flex justify-around py-2 text-xs text-slate-300">
        <Link href="/mobile">Home</Link>
        <Link href="/mobile/explore">Explore</Link>
        <Link href="/mobile/nearby" className="text-white">
          Nearby
        </Link>
        <Link href="/mobile/profile">Profile</Link>
        <Link href="/admin">Admin</Link>
      </nav>
    </main>
  );
}