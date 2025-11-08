// src/app/mobile/nearby/page.tsx
'use client';

import { useState } from 'react';
import BottomNav from '../../components/BottomNav';
import { mockPlaces } from '@/app/data/places';
import Link from 'next/link';

const filters = ['All', 'Coffee', 'Parks', 'Restaurants', 'Workspaces', 'Events', 'Shopping'];

export default function NearbyPage() {
  const [activeFilter, setActiveFilter] = useState<string>('All');

  // sort by distance, then filter
  const nearbyPlaces = mockPlaces
    .slice() // copy first
    .sort((a, b) => a.distance - b.distance)
    .filter((place) => {
      if (activeFilter === 'All') return true;
      return place.category === activeFilter;
    });

  return (
    <main className="min-h-screen bg-white pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 py-3">
        <h1 className="text-2xl font-bold text-gray-900">Nearby</h1>
        <p className="text-sm text-gray-500">Places close to you, from our shared data.</p>
      </header>

      {/* Filters */}
      <section className="px-4 py-3 flex gap-2 overflow-x-auto scrollbar-none">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-3 py-1 rounded-full text-sm border transition ${
              activeFilter === f
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white text-gray-700 border-gray-200'
            }`}
          >
            {f}
          </button>
        ))}
      </section>

      {/* List */}
      <section className="px-4 space-y-3">
        {nearbyPlaces.map((place) => (
          <Link
            key={place.id}
            href={`/mobile/places/${place.id}`}
            className="block border border-gray-100 rounded-xl p-4 shadow-sm hover:border-purple-200 transition"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-gray-900 flex items-center gap-2">
                    {place.name}
                    {place.trending ? (
                      <span className="text-[10px] uppercase bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                        trending
                      </span>
                    ) : null}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{place.category}</p>
                <p className="text-sm text-gray-500 mt-1 line-clamp-1">{place.description}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {place.reviews} reviews • {place.rating.toFixed(1)} ★
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{place.distance} mi</p>
                <p className="text-[10px] text-gray-400 mt-1">open until {place.openUntil}</p>
                <p className="text-[10px] text-gray-500 mt-1">{place.busy}</p>
              </div>
            </div>
          </Link>
        ))}

        {nearbyPlaces.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">No places found.</p>
        )}
      </section>

      <BottomNav />
    </main>
  );
}