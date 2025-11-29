// src/app/mobile/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { mockPlaces } from "@/app/data/places";

type TabKey = "trending" | "nearby" | "saved";

export default function MobileHomePage() {
  const [activeTab, setActiveTab] = useState<TabKey>("trending");
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [interest, setInterest] = useState("");
  const [savingInterest, setSavingInterest] = useState(false);
  const [interestSaved, setInterestSaved] = useState(false);

  // load saved ids from API once
  useEffect(() => {
    async function loadSaved() {
      try {
        const res = await fetch("/api/saved", { cache: "no-store" });
        const data = await res.json();
        setSavedIds(Array.isArray(data.items) ? data.items : []);
      } catch (err) {
        console.error("Failed to load saved places", err);
      }
    }
    loadSaved();
  }, []);

  // toggle + sync to API
  const toggleSave = async (id: string) => {
    const isSaved = savedIds.includes(id);

    // optimistic UI
    setSavedIds((prev) =>
      isSaved ? prev.filter((x) => x !== id) : [...prev, id]
    );

    try {
      await fetch("/api/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          action: isSaved ? "remove" : "add",
        }),
      });
    } catch (err) {
      console.error("Failed to update saved on server", err);
      // optional: revert – for now just log
    }
  };

  // send lightweight user + interest to backend
  const sendCollectedUser = async () => {
    const trimmed = interest.trim();
    if (!trimmed) return;

    setSavingInterest(true);
    setInterestSaved(false);

    try {
      const res = await fetch("/api/users/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Mobile visitor",
          email: "no-email@example.com",
          source: "mobile-home",
          interest: trimmed,
        }),
      });
      await res.json();
      setInterest("");
      setInterestSaved(true);
    } catch (err) {
      console.error("failed to collect user from mobile", err);
    } finally {
      setSavingInterest(false);
    }
  };

  // simple helpers to make the tabs feel different
  const trendingPlaces = mockPlaces.filter((p) => p.trending);
  const nearbyPlaces = [...mockPlaces].sort(
    (a, b) => (a.distanceMiles ?? 999) - (b.distanceMiles ?? 999)
  );
  const savedPlaces = mockPlaces.filter((p) =>
    savedIds.includes(p.id.toString())
  );

  let shownPlaces = trendingPlaces;
  if (activeTab === "nearby") shownPlaces = nearbyPlaces;
  if (activeTab === "saved") shownPlaces = savedPlaces;

  return (
    <main className="min-h-screen bg-slate-950 text-white pb-16">
      {/* Hero / header */}
      <header className="px-4 pt-6 pb-4 space-y-2 bg-gradient-to-b from-slate-900/90 to-slate-950">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Foundzie
            </h1>
            <p className="text-xs text-slate-400">
              Lightning-fast concierge for what&apos;s around you.
            </p>
          </div>
          <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/40">
            Concierge online
          </span>
        </div>

        <p className="text-[11px] text-slate-400">
          Open the app, see places instantly. Tap any spot to chat or book via
          your concierge.
        </p>
      </header>

      {/* Tabs */}
      <section className="px-4 pt-3">
        <div className="inline-flex rounded-full bg-slate-900 p-1 gap-1">
          {(["trending", "nearby", "saved"] as TabKey[]).map((tab) => {
            const isActive = activeTab === tab;
            const label =
              tab === "trending"
                ? "Trending"
                : tab === "nearby"
                ? "Nearby"
                : "Saved";

            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={[
                  "px-3 py-1.5 rounded-full text-xs transition-colors",
                  isActive
                    ? "bg-pink-500 text-white shadow-sm"
                    : "text-slate-300",
                ].join(" ")}
              >
                {label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          {activeTab === "trending" &&
            "Popular spots people are loving right now."}
          {activeTab === "nearby" &&
            "Sorted by distance so you can decide quickly."}
          {activeTab === "saved" &&
            "Your shortlist of favourites to revisit later."}
        </p>
      </section>

      {/* Places list */}
      <section className="mt-2">
        {shownPlaces.length === 0 && activeTab === "saved" ? (
          <div className="px-4 py-10 text-center text-slate-500 text-sm">
            You haven&apos;t saved any places yet.
            <br />
            <span className="text-[11px] text-slate-400">
              Tap the ☆ icon on any place to save it.
            </span>
          </div>
        ) : (
          <ul className="divide-y divide-slate-800">
            {shownPlaces.map((p) => (
              <li
                key={p.id}
                className="px-4 py-4 flex justify-between items-center"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-[11px] text-slate-400">
                    {p.category}
                    {typeof p.distanceMiles === "number" && (
                      <> • {p.distanceMiles} mi</>
                    )}
                    {typeof p.rating === "number" && (
                      <> • {p.rating.toFixed(1)} ★</>
                    )}
                  </p>
                  {p.description && (
                    <p className="text-[11px] text-slate-500 line-clamp-1">
                      {p.description}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2">
                  <Link
                    href={`/mobile/places/${p.id}`}
                    className="text-[11px] text-pink-400 underline"
                  >
                    View details
                  </Link>
                  <button
                    onClick={() => toggleSave(p.id.toString())}
                    className="text-xs px-2 py-1 rounded-full border border-slate-700 bg-slate-900/60"
                  >
                    {savedIds.includes(p.id.toString()) ? "★ Saved" : "☆ Save"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Interest capture area */}
      <section className="px-4 py-5 mt-1 border-t border-slate-900/70 bg-slate-950/90 space-y-2">
        <p className="text-xs text-slate-300">
          Tell Foundzie what you&apos;re into and we&apos;ll use it to tune
          suggestions.
        </p>

        <div className="flex gap-2">
          <input
            value={interest}
            onChange={(e) => {
              setInterest(e.target.value);
              if (interestSaved) setInterestSaved(false);
            }}
            placeholder="e.g. brunch, parks, live music"
            className="flex-1 bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-xs outline-none focus:border-slate-400"
          />
          <button
            onClick={sendCollectedUser}
            disabled={savingInterest || !interest.trim()}
            className="text-xs px-3 py-2 rounded-lg bg-pink-500 disabled:opacity-60"
          >
            {savingInterest ? "Saving..." : "Save"}
          </button>
        </div>

        {interestSaved && (
          <p className="text-[11px] text-emerald-400">
            Saved. Your concierge can now see this in the admin panel.
          </p>
        )}

        <p className="text-[10px] text-slate-500">
          This sends a lightweight profile to <code>/api/users/collect</code>{" "}
          without any login.
        </p>
      </section>
    </main>
  );
}
