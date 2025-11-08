// src/app/mobile/page.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { mockPlaces } from "@/app/data/places";
import { savedPlaceIds } from "@/app/data/saved";

// make a flexible Place type that allows either distanceMiles or distance
type Place = (typeof mockPlaces)[number] & {
  distance?: number;
  distanceMiles?: number;
};

const TABS = ["trending", "nearby", "saved"] as const;
type Tab = (typeof TABS)[number];

// build the 3 lists
const trending: Place[] = mockPlaces;
const nearby: Place[] = mockPlaces;
const saved: Place[] = savedPlaceIds
  .map((id) => mockPlaces.find((p) => p.id === id))
  .filter(Boolean) as Place[];

function PlaceRow({ place }: { place: Place }) {
  // handle both distanceMiles and distance
  const distance =
    typeof place.distanceMiles === "number"
      ? place.distanceMiles
      : typeof place.distance === "number"
      ? place.distance
      : undefined;

  return (
    <Link
      href={`/mobile/places/${place.id}`}
      className="flex items-center justify-between py-3 border-b border-slate-800"
    >
      <div>
        <p className="font-medium text-white">{place.name}</p>
        <p className="text-xs text-slate-400">{place.category}</p>
      </div>
      <div className="text-right text-xs text-slate-400 space-y-1">
        {typeof distance === "number" ? <p>{distance} mi</p> : null}
        {place.openUntil ? <p>open until {place.openUntil}</p> : null}
      </div>
    </Link>
  );
}

export default function MobileHomePage() {
  const [activeTab, setActiveTab] = useState<Tab>("trending");

  let listToShow: Place[] = trending;
  if (activeTab === "nearby") listToShow = nearby;
  if (activeTab === "saved") listToShow = saved;

  return (
    <main className="min-h-screen bg-[#0f172a] text-white">
      <header className="px-4 pt-5 pb-3">
        <h1 className="text-lg font-semibold">Foundzie</h1>
        <p className="text-sm text-slate-300">What&apos;s near you</p>
      </header>

      {/* tabs */}
      <div className="px-4 flex gap-2 mb-4">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 rounded-full text-sm capitalize ${
              activeTab === tab
                ? "bg-fuchsia-500 text-white"
                : "bg-slate-800 text-slate-200"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* list */}
      <div className="px-4">
        {listToShow.length === 0 ? (
          <p className="text-slate-400 text-sm py-6">
            Nothing saved yet. Go explore and favorite some places.
          </p>
        ) : (
          listToShow.map((place) => <PlaceRow key={place.id} place={place} />)
        )}
      </div>

      {/* bottom nav (just to match your existing screen a bit) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0f172a] border-t border-slate-800 flex justify-around py-2 text-xs text-slate-300">
        <Link href="/mobile" className="text-white">
          Home
        </Link>
        <Link href="/mobile/explore">Explore</Link>
        <Link href="/admin">Admin</Link>
        <Link href="/mobile/profile">Profile</Link>
        <Link href="/mobile/sos">SOS</Link>
      </nav>
    </main>
  );
}