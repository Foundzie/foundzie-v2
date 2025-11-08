// src/app/mobile/page.tsx
'use client';

import { useState } from 'react';
import BottomNav from '../components/BottomNav';
import mockPlaces from '@/app/data/places';
import savedPlaceIds from '@/app/data/saved';
import Link from 'next/link';

type Tab = 'trending' | 'nearby' | 'saved';

export default function MobileHomePage() {
  const [activeTab, setActiveTab] = useState<Tab>('trending');

  // break the data up
  const trendingPlaces = mockPlaces.filter((p) => p.trending);
  const nearbyPlaces = mockPlaces; // for now just show all
  const savedPlaces = mockPlaces.filter((p) => savedPlaceIds.includes(p.id));

  // decide which list to show
  let listToShow = trendingPlaces;
  if (activeTab === 'nearby') listToShow = nearbyPlaces;
  if (activeTab === 'saved') listToShow = savedPlaces;

  return (
    <main className="min-h-screen bg-white pb-20">
      {/* top bar */}
      <header className="px-4 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Foundzie</h1>
          <p className="text-xs text-gray-500">What&apos;s near you</p>
        </div>
        <Link href="/mobile/notifications" className="text-purple-600 text-sm underline">
          alerts
        </Link>
      </header>

      {/* search */}
      <div className="px-4 pt-4">
        <input
          type="text"
          placeholder="Search places..."
          className="w-full border border-gray-200 rounded-full px-4 py-2 text-sm outline-none"
        />
      </div>

      {/* tabs */}
      <div className="px-4 mt-4 flex gap-2">
        <button
          onClick={() => setActiveTab('trending')}
          className={`flex-1 text-center text-sm py-2 rounded-full ${
            activeTab === 'trending' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700'
          }`}
        >
          Trending
        </button>
        <button
          onClick={() => setActiveTab('nearby')}
          className={`flex-1 text-center text-sm py-2 rounded-full ${
            activeTab === 'nearby' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700'
          }`}
        >
          Nearby
        </button>
        <button
          onClick={() => setActiveTab('saved')}
          className={`flex-1 text-center text-sm py-2 rounded-full ${
            activeTab === 'saved' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700'
          }`}
        >
          Saved
        </button>
      </div>

      {/* list */}
      <section className="px-4 mt-4 space-y-3">
        {listToShow.length === 0 ? (
          <p className="text-xs text-gray-400 py-6 text-center">
            Nothing here yet.
          </p>
        ) : (
          listToShow.map((place) => (
            <Link
              key={place.id}
              href={`/mobile/places/${place.id}`}
              className="flex items-center justify-between border border-gray-100 rounded-xl px-3 py-3 shadow-sm"
            >
              <div>
                <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  {place.name}
                  {place.trending && activeTab !== 'saved' ? (
                    <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                      TRENDING
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-gray-500">{place.category}</p>
                <p className="text-[10px] text-gray-400">
                  {place.description}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-600">{place.distance} mi</p>
                <p className="text-[10px] text-gray-400">
                  open until {place.openUntil}
                </p>
              </div>
            </Link>
          ))
        )}
      </section>

      <BottomNav />
    </main>
  );
}