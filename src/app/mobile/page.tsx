"use client";

import Link from "next/link";
import { mockPlaces } from "@/app/data/places";
import { mockSavedPlaces } from "@/app/data/saved";
import { useState } from "react";

export default function MobileHomePage() {
  const [activeTab, setActiveTab] = useState<"trending" | "nearby" | "saved">(
    "trending"
  );

  const trending = mockPlaces;
  const nearby = mockPlaces;
  const saved = mockSavedPlaces;

  const tabs: { id: "trending" | "nearby" | "saved"; label: string }[] = [
    { id: "trending", label: "Trending" },
    { id: "nearby", label: "Nearby" },
    { id: "saved", label: "Saved" },
  ];

  let listToShow = trending;
  if (activeTab === "nearby") listToShow = nearby;
  if (activeTab === "saved") listToShow = saved;

  return (
    <main className="min-h-screen bg-[#0f172a] text-white">
      <header className="p-4 space-y-3">
        <h1 className="text-2xl font-semibold">Foundzie</h1>
        <p className="text-sm text-slate-200">What&apos;s near you</p>

        <div className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-sm">
          <input
            type="text"
            placeholder="Search places..."
            className="bg-transparent outline-none w-full text-sm placeholder:text-slate-400"
          />
        </div>

        <div className="flex gap-2 mt-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 rounded-md py-2 text-center text-sm transition
                ${
                  activeTab === tab.id
                    ? "bg-purple-600 text-white"
                    : "bg-slate-900/40 text-slate-200 border border-slate-800"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <section className="px-4 pb-16 space-y-2">
        {listToShow.length === 0 ? (
          <p className="text-slate-400 text-sm mt-4">
            Nothing here yet. Save a place from Explore.
          </p>
        ) : (
          <ul className="space-y-2">
            {listToShow.map((place: any) => (
              <li
                key={place.id}
                className="bg-slate-900/40 border border-slate-800 rounded-lg px-3 py-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium">{place.name}</p>
                  <p className="text-xs text-slate-400">
                    {place.category}{" "}
                    {place.description ? `· ${place.description}` : null}
                  </p>
                  {place.distanceMiles ? (
                    <p className="text-xs text-slate-500 mt-1">
                      {place.distanceMiles} mi
                    </p>
                  ) : null}
                </div>
                <Link
                    href={`/mobile/places/${place.id}`}
                    className="text-xs text-purple-300 hover:text-purple-100"
                  >
                  View
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="fixed bottom-0 left-0 right-0 bg-slate-950/90 border-t border-slate-800 px-6 py-2 flex justify-between text-xs text-slate-200">
        <Link href="/mobile" className="text-purple-200">
          Home
        </Link>
        <Link href="/mobile/explore">Explore</Link>
        <Link href="/mobile/notifications">Alerts</Link>
        <Link href="/mobile/sos">SOS</Link>
      </footer>
    </main>
  );
}