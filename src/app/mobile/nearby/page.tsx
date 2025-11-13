// src/app/mobile/nearby/page.tsx
"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";

type Place = {
  id: string;
  name: string;
  category?: string;
  distanceMiles?: number;
};

export default function NearbyPage() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);

  // NEW: lightweight interest capture state
  const [interest, setInterest] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/places");
        const json = await res.json();
        setPlaces((json.data ?? []) as Place[]);
      } catch (e) {
        console.error("failed to load places", e);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const sorted = [...places].sort(
    (a, b) => (a.distanceMiles ?? 999) - (b.distanceMiles ?? 999),
  );

  // NEW: send interest → /api/users/collect
  async function handleSaveInterest(e: FormEvent) {
    e.preventDefault();
    const trimmed = interest.trim();
    if (!trimmed) return;

    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      await fetch("/api/users/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interest: trimmed,
          source: "mobile-nearby",
          // store as real array so admin can target
          tags: [trimmed],
        }),
      });

      setSaved(true);
    } catch (err) {
      console.error("Failed to save interest", err);
      setError("Could not save interest. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="px-4 py-4 border-b border-slate-800">
        <h1 className="text-lg font-semibold">Nearby</h1>
        <p className="text-slate-400 text-sm">Places near your location</p>
      </header>

      {/* NEW: simple interest capture bar */}
      <section className="px-4 py-3 border-b border-slate-800 space-y-2">
        <p className="text-xs text-slate-400">
          Tell Foundzie what you&apos;re into and we&apos;ll use it to improve
          suggestions.
        </p>
        <form onSubmit={handleSaveInterest} className="flex gap-2">
          <input
            value={interest}
            onChange={(e) => {
              setInterest(e.target.value);
              if (saved) setSaved(false);
              if (error) setError(null);
            }}
            placeholder="e.g. brunch, nightlife"
            className="flex-1 rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-xs outline-none focus:border-slate-400"
          />
          <button
            type="submit"
            disabled={saving || interest.trim().length === 0}
            className="px-3 py-2 rounded-md text-xs font-medium bg-purple-600 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </form>

        {saved && (
          <p className="text-[11px] text-emerald-400">
            Saved. We&apos;ll remember this for future recommendations.
          </p>
        )}
        {error && <p className="text-[11px] text-red-400">{error}</p>}
      </section>

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
              <p className="text-xs text-slate-500">
                {p.distanceMiles ?? "—"} mi
              </p>
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
