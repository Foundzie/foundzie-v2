'use client';

import { useState } from 'react';
import BottomNav from '../../components/BottomNav';
import PlaceCard from '../../components/PlaceCard';
import { MapPin, Navigation, Sliders } from 'lucide-react';
import { mockPlaces } from '@/app/data/places';

// we’ll just reuse the same data you use everywhere
const nearbyPlaces = mockPlaces;

export default function NearbyPage() {
  const [sortBy, setSortBy] = useState<'distance' | 'rating'>('distance');

  // sort but be careful not to mutate original array
  const sorted = [...nearbyPlaces].sort((a, b) => {
    if (sortBy === 'distance') return a.distance - b.distance;
    return b.rating - a.rating;
  });

  // ✅ make busy OPTIONAL-safe
  function getBusyColor(busy?: string): string {
    const value = busy ?? 'Moderate'; // default if missing
    switch (value) {
      case 'Quiet':
        return 'bg-green-100 text-green-800';
      case 'Moderate':
        return 'bg-yellow-100 text-yellow-800';
      case 'Busy':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  return (
    <main className="min-h-screen bg-white pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Nearby</h1>
            <p className="text-xs text-gray-500">Spots close to you</p>
          </div>
          <button className="relative p-2 hover:bg-gray-100 rounded-full transition">
            <Navigation className="w-5 h-5 text-purple-600" />
          </button>
        </div>

        {/* Sort options */}
        <div className="flex gap-2 px-4 pb-3">
          <button
            onClick={() => setSortBy('distance')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition ${
              sortBy === 'distance'
                ? 'bg-purple-100 text-purple-900'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Closest
          </button>
          <button
            onClick={() => setSortBy('rating')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition ${
              sortBy === 'rating'
                ? 'bg-purple-100 text-purple-900'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Top rated
          </button>
        </div>

        {/* Location */}
        <div className="px-4 pb-3 bg-purple-50 border-t border-purple-100 flex items-center gap-2 text-sm text-purple-900">
          <MapPin className="w-4 h-4" />
          <span>Your location: Chicago, IL</span>
        </div>
      </header>

      {/* Places list */}
      <section className="px-4 py-4">
        <div className="space-y-3">
          {sorted.map((place) => (
            <div
              key={place.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
            >
              <div className="flex gap-3">
                {/* Icon / image */}
                <div className="text-3xl flex-shrink-0">
                  {place.image ?? '📍'}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">
                        {place.name}
                      </h3>
                      <p className="text-xs text-gray-500">{place.category}</p>
                    </div>
                    <span className="text-xs text-gray-400">
                      {place.distance.toFixed(1)} mi
                    </span>
                  </div>

                  {/* Rating */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-gray-900">
                      ⭐ {place.rating}
                    </span>
                    <span className="text-xs text-gray-400">
                      ({place.reviews})
                    </span>
                  </div>

                  {/* Status row – ✅ this was crashing Vercel */}
                  <div className="flex gap-2 flex-wrap">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full ${getBusyColor(
                        place.busy
                      )}`}
                    >
                      {place.busy ?? 'Moderate'}
                    </span>
                    {place.openUntil && (
                      <span className="text-xs text-gray-600 px-2 py-1 bg-gray-100 rounded-full">
                        Until {place.openUntil}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* CTA */}
              <button className="w-full mt-3 py-2 px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 text-sm font-medium rounded-lg transition">
                View details
              </button>
            </div>
          ))}
        </div>
      </section>

      <BottomNav />
    </main>
  );
}