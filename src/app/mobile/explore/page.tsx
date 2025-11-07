'use client';

import { useState } from 'react';
import BottomNav from '../../components/BottomNav';
import PlaceCard from '../../components/PlaceCard';
import { Search, Filter, ChevronRight } from 'lucide-react';
import { mockPlaces } from "@/app/data/places";

const categories = [
  { id: 1, name: 'Coffee', icon: '☕', count: 24 },
  { id: 2, name: 'Parks', icon: '🌳', count: 12 },
  { id: 3, name: 'Restaurants', icon: '🍽️', count: 48 },
  { id: 4, name: 'Workspaces', icon: '💻', count: 8 },
  { id: 5, name: 'Events', icon: '🎉', count: 15 },
  { id: 6, name: 'Shopping', icon: '🛍️', count: 32 },
];

const allPlaces = [
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
  {
    id: 5,
    name: 'Urban Market',
    category: 'Shopping',
    distance: 1.5,
    rating: 4.5,
    reviews: 156,
    image: '🛍️',
    trending: false,
    description: 'Local artisan goods',
  },
];

export default function ExplorePage() {
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPlaces = mockPlaces.filter((place) => {
    const matchesCategory = !selectedCategory || place.category === categories.find(c => c.id === selectedCategory)?.name;
    const matchesSearch = place.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <main className="min-h-screen bg-white pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="px-4 py-3">
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Explore</h1>

          {/* Search Bar */}
          <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search places..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-sm outline-none flex-1 text-gray-700 placeholder-gray-500"
            />
          </div>
        </div>
      </header>

      {/* Categories */}
      <section className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Categories</h2>
          <button className="flex items-center gap-1 text-purple-600 text-xs font-medium hover:underline">
            <Filter className="w-3 h-3" />
            Filter
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
              className={`p-3 rounded-lg text-center transition ${
                selectedCategory === cat.id
                  ? 'bg-purple-100 border-2 border-purple-600'
                  : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              <div className="text-2xl mb-1">{cat.icon}</div>
              <p className="text-xs font-medium text-gray-900">{cat.name}</p>
              <p className="text-xs text-gray-500">{cat.count}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Results */}
      <section className="px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">
            {selectedCategory ? `${categories.find(c => c.id === selectedCategory)?.name}` : 'All Places'} ({filteredPlaces.length})
          </h2>
        </div>

        {filteredPlaces.length > 0 ? (
          <div className="space-y-3">
            {filteredPlaces.map((place) => (
              <PlaceCard key={place.id} place={place} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm">No places found</p>
          </div>
        )}
      </section>

      <BottomNav />
    </main>
  );
}