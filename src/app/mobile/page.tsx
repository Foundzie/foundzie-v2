// src/app/mobile/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { mockPlaces } from "@/app/data/places";

export default function MobileHomePage() {
  const [activeTab, setActiveTab] = useState<"trending" | "nearby" | "saved">(
    "trending"
  );
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [interest, setInterest] = useState(""); // NEW: user preference from mobile

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

    // update UI immediately
    setSavedIds((prev) =>
      isSaved ? prev.filter((x) => x !== id) : [...prev, id]
    );

    // tell backend
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
      // optional: revert UI here if you want
    }
  };

  // NEW: send lightweight user + interest to backend
  const sendCollectedUser = async () => {
    try {
      const res = await fetch("/api/users/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Mobile visitor",
          email: "no-email@example.com",
          source: "mobile-home",
          interest: interest.trim() || undefined,
        }),
      });
      const data = await res.json();
      console.log("collect result:", data);
      // you could clear the input if you want:
      // setInterest("");
    } catch (err) {
      console.error("failed to collect user from mobile", err);
    }
  };

  // pick what to show
  const shownPlaces =
    activeTab === "saved"
      ? mockPlaces.filter((p) => savedIds.includes(p.id.toString()))
      : mockPlaces; // for now trending/nearby just show all like before

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="px-4 pt-6 pb-2 space-y-2">
        <h1 className="text-xl font-bold">Foundzie</h1>
        <p className="text-xs text-slate-400">What&apos;s near you</p>
      </div>

      {/* Tabs */}
      <div className="flex px-4 py-2 gap-2">
        {["trending", "nearby", "saved"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-3 py-1 rounded-full text-xs ${
              activeTab === tab ? "bg-pink-500 text-white" : "bg-slate-900 text-slate-300"
            }`}
          >
            {tab[0].toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      <ul>
        {shownPlaces.length === 0 && activeTab === "saved" ? (
          <li className="px-4 py-8 text-slate-500 text-center">
            No saved places yet.
          </li>
        ) : null}

        {shownPlaces.map((p) => (
          <li
            key={p.id}
            className="px-4 py-4 flex justify-between items-center border-b border-slate-800"
          >
            <div>
              <p className="text-sm font-medium">{p.name}</p>
              <p className="text-xs text-slate-400">{p.category}</p>
            </div>

            <div className="flex gap-2 items-center">
              <Link
                href={`/mobile/places/${p.id}`}
                className="text-xs text-pink-400 underline"
              >
                View
              </Link>

              <button
                onClick={() => toggleSave(p.id.toString())}
                className="text-xs"
              >
                {savedIds.includes(p.id.toString()) ? "★" : "☆"}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* NEW: interest capture area */}
      <div className="px-4 py-6 space-y-2">
        <p className="text-xs text-slate-400">
          Tell Foundzie what you like (saved to admin):
        </p>
        <div className="flex gap-2">
          <input
            value={interest}
            onChange={(e) => setInterest(e.target.value)}
            placeholder="e.g. brunch, parks, events"
            className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs outline-none"
          />
          <button
            onClick={sendCollectedUser}
            className="text-xs bg-slate-800 rounded-md px-3 py-1"
          >
            Save
          </button>
        </div>
        <p className="text-[10px] text-slate-500">
          This hits <code>/api/users/collect</code> — no login.
        </p>
      </div>
    </main>
  );
}
