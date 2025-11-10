"use client";
import { useState } from "react";
import Link from "next/link";
import { mockPlaces } from "@/app/data/places";

export default function MobileHomePage() {
  const [activeTab, setActiveTab] = useState<"trending" | "nearby" | "saved">("trending");
  const [savedIds, setSavedIds] = useState<string[]>([]);

  const toggleSave = (id: string) => {
    setSavedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const shownPlaces =
    activeTab === "saved"
      ? mockPlaces.filter((p) => savedIds.includes(p.id.toString()))
      : mockPlaces;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <h1 className="text-xl font-bold px-4 pt-6 pb-2">Foundzie</h1>
      <p className="text-sm text-slate-400 px-4">What’s near you</p>

      {/* Tabs */}
      <div className="flex px-4 py-2 gap-2">
        {["trending", "nearby", "saved"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-3 py-1 rounded-full text-xs ${
              activeTab === tab
                ? "bg-pink-500 text-white"
                : "bg-slate-900 text-slate-300"
            }`}
          >
            {tab[0].toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      <ul>
        {shownPlaces.length === 0 && (
          <li className="px-4 py-8 text-slate-500 text-center">No saved places yet.</li>
        )}
        {shownPlaces.map((p) => (
          <li
            key={p.id}
            className="px-4 py-4 flex justify-between items-center border-b border-slate-800"
          >
            <div>
              <p className="text-sm font-medium">{p.name}</p>
              <p className="text-xs text-slate-400">{p.category}</p>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/mobile/places/${p.id}`}
                className="text-xs text-pink-400 underline"
              >
                View
              </Link>
              <button
                onClick={() => toggleSave(p.id.toString())}
                className={`text-xs ${
                  savedIds.includes(p.id.toString())
                    ? "text-yellow-400"
                    : "text-slate-500"
                }`}
              >
                {savedIds.includes(p.id.toString()) ? "★" : "☆"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}