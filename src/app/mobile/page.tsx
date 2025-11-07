'use client';

import { useState } from 'react';
import BottomNav from '../components/BottomNav';
import PlaceCard from '../components/PlaceCard';
import { MapPin, Bell, Search, Zap } from 'lucide-react';

const mockPlaces = [
  {
    id: 1,
    name: 'Sunny Café',
    category: 'Coffee',
    distance: 0.3,
    rating: 4.8,
    reviews: 124,
    image: '☕',
    trending: true,
    description: 'Cozy spot with great vibes',
  },
  {
    id: 2,
    name: 'Central Park',
    category: 'Parks',
    distance: 0.5,
    rating: 4.9,
    reviews: 892,
    image: '🌳',
    trending: true,
    description: 'Perfect for weekend walks',
  },
  {
    id: 3,
    name: 'Tech Hub',
    category: 'Workspace',
    distance: 0.8,
    rating: 4.6,
    reviews: 45,
    image: '💻',
    trending: false,
    description: 'Quiet place to work',
  },
  {
    id: 4,
    name: 'Bistro 41',
    category: 'Restaurant',
    distance: 1.2,
    rating: 4.7,
    reviews: 203,
    image: '🍽️',
    trending: false,
    description: 'Amazing brunch menu',
  },
];

export default function MobileHome() {
  const [notificationCount] = useState(3);

  return (
    <main className="min-h-screen bg-gradient-to-b from-purple-50 to-white pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-purple-900">Foundzie</h1>
            <p className="text-xs text-gray-500">What's near you</p>
          </div>
          <button className="relative p-2 hover:bg-gray-100 rounded-full transition">
            <Bell className="w-5 h-5 text-gray-700" />
            {notificationCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search places..."
              className="bg-transparent text-sm outline-none flex-1 text-gray-700 placeholder-gray-500"
            />
          </div>
        </div>
      </header>

      {/* Location & Quick Actions */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
          <MapPin className="w-4 h-4 text-purple-600" />
          <span>Chicago, IL • 72°F</span>
        </div>

        {/* Quick Action Buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button className="bg-purple-100 hover:bg-purple-200 text-purple-900 text-xs font-medium py-2 px-3 rounded-lg transition flex items-center justify-center gap-1">
            <Zap className="w-3 h-3" />
            Trending
          </button>
          <button className="bg-blue-100 hover:bg-blue-200 text-blue-900 text-xs font-medium py-2 px-3 rounded-lg transition">
            Events
          </button>
          <button className="bg-green-100 hover:bg-green-200 text-green-900 text-xs font-medium py-2 px-3 rounded-lg transition">
            Saved
          </button>
        </div>
      </div>

      {/* Featured Section */}
      <section className="px-4 py-4">
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-2xl p-4 text-white shadow-lg">
          <p className="text-xs font-semibold opacity-90 mb-1">FEATURED</p>
          <h3 className="text-lg font-bold mb-1">Sunny Café</h3>
          <p className="text-sm opacity-90 mb-3">New spot trending in your area</p>
          <button className="bg-white text-purple-600 font-semibold text-sm py-2 px-4 rounded-lg hover:bg-gray-100 transition w-full">
            View Details
          </button>
        </div>
      </section>

      {/* Nearby Places */}
      <section className="px-4 py-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">Nearby Places</h2>
          <a href="/mobile/nearby" className="text-purple-600 text-sm font-medium hover:underline">
            See all
          </a>
        </div>

        <div className="space-y-3">
          {mockPlaces.map((place) => (
            <PlaceCard key={place.id} place={place} />
          ))}
        </div>
      </section>

      {/* Footer Spacing */}
      <div className="h-4" />

      <BottomNav />
    </main>
  );
}