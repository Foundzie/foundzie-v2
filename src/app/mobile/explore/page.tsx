'use client';

import { useState } from 'react';
import BottomNav from '../../components/BottomNav';
import PlaceCard from '../../components/PlaceCard';
import { Search, Filter, ChevronRight } from 'lucide-react';
import mockPlaces, { Place } from '@/app/data/places';

// you can keep showing these categories in the UI
const categories = [
  { id: 1, name: 'Coffee', icon: '☕', count: 24 },
  { id: 2, name: 'Parks', icon: '🌳', count: 12 },
  { id: 3, name: 'Restaurants', icon: '🍽️', count: 48 },
  { id: 4, name: 'Workspaces', icon: '💻', count: 8 },
  { id: 5, name: 'Events', icon: '🎉', count: 15 },
  { id: 6, name: 'Shopping', icon: '🛍️', count: 32 },
];

export default function ExplorePage() {
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // 👉 use ONLY the shared mockPlaces from src/app/data/places.ts
  const filteredPlaces = mockPlaces.filter((place) => {
    // match category (or "all")
    const matchesCategory =
      selectedCategory === null
        ? true
        : place.category ===
          categories.find((c) => c.id === selectedCategory)?.name;

    // match text search
    const matchesSearch = place.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  return (
    <main className="min-h-screen bg-white pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 py-3">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Explore</h1>

        {/* Search bar */}
        <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search places..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-sm outline-none flex-1 text-gray-700 placeholder-gray-500"
          />
          <button className="p-1 text-purple-600">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Categories */}
      <section className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Categories</h2>
          <button className="flex items-center gap-1 text-purple-600 text-xs font-medium hover:underline">
            Filter
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() =>
                setSelectedCategory(
                  selectedCategory === cat.id ? null : cat.id
                )
              }
              className={`rounded-lg text-center transition ${
                selectedCategory === cat.id
                  ? 'bg-purple-100 border border-purple-600'
                  : 'bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="text-2xl mb-1">{cat.icon}</div>
              <div className="text-xs font-medium text-gray-900">
                {cat.name}
              </div>
              <div className="text-[10px] text-gray-500">{cat.count}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Results */}
      <section className="px-4 py-4 space-y-3">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-gray-900">
            {selectedCategory
              ? categories.find((c) => c.id === selectedCategory)?.name
              : 'All Places'}{' '}
            ({filteredPlaces.length})
          </h2>
        </div>

        {filteredPlaces.length > 0 ? (
          <div className="space-y-3">
            {filteredPlaces.map((place: Place) => (
              <PlaceCard key={place.id} place={place} />
            ))}
          </div>
        ) : (
          <p className="text-center py-8 text-sm text-gray-500">
            No places found
          </p>
        )}
      </section>

      <BottomNav />
    </main>
  );
}
