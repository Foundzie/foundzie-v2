"use client";

import { useState } from "react";
import Link from "next/link";
import { trendingPlaces, nearbyPlaces, allPlaces } from "@/app/data/places";
import { savedPlaceIds } from "@/app/data/saved";

export default function MobileHomePage() {
  const [activeTab, setActiveTab] = useState<"trending" | "nearby" | "saved">("trending");

  // Automatically build savedPlaces from allPlaces using savedPlaceIds
  const savedPlaces = allPlaces.filter((place) => savedPlaceIds.includes(place.id));

  // Pick which dataset to show based on the active tab
  const places =
    activeTab === "trending"
      ? trendingPlaces
      : activeTab === "nearby"
      ? nearbyPlaces
      : savedPlaces;

  return (
    <main className="p-4 bg-slate-950 text-white min-h-screen">
      <h1 className="text-lg font-semibold mb-4">What's near you</h1>

      {/* Search bar */}
      <input
        type="text"
        placeholder="Search nearby places..."
        className="w-full mb-4 p-2 rounded-md bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-400"
      />

      {/* Tabs */}
      <div className="flex space-x-4 mb-4">
        {["trending", "nearby", "saved"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-3 py-1 text-sm rounded-full ${
              activeTab === tab ? "bg-pink-600 text-white" : "bg-slate-800 text-slate-300"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Places list */}
      <ul>
        {places.length > 0 ? (
          places.map((place) => (
            <li key={place.id} className="border-b border-slate-800 py-3">
              <Link href={`/mobile/places/${place.id}`}>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-base font-medium">{place.name}</p>
                    <p className="text-xs text-slate-400">{place.category}</p>
                  </div>
                  <div className="text-xs text-slate-400">{place.distance} mi</div>
                </div>
              </Link>
            </li>
          ))
        ) : (
          <li className="text-sm text-slate-400 py-4">No places found.</li>
        )}
      </ul>
    </main>
  );
}