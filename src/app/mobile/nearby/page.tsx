'use client';

import { useState } from 'react';
import BottomNav from '../../components/BottomNav';
import PlaceCard from '../../components/PlaceCard';
import { MapPin, Navigation, Sliders } from 'lucide-react';

const nearbyPlaces = [
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
    openUntil: '9:00 PM',
    busy: 'Moderate',
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
    openUntil: 'Always open',
    busy: 'Quiet',
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
    openUntil: '10:00 PM',
    busy: 'Quiet',
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
    openUntil: '11:00 PM',
    busy: 'Busy',
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
    openUntil: '8:00 PM',
    busy: 'Moderate',
  },
];

export default function NearbyPage() {
  const [sortBy, setSortBy] = useState<'distance' | 'rating'>('distance');

  const sorted = [...nearbyPlaces].sort((a, b) => {
    if (sortBy === 'distance') return a.distance - b.distance;
    return b.rating - a.rating;
  });

  const getBusyColor = (busy: string) => {
    switch (busy) {
      case 'Quiet':
        return 'bg-green-100 text-green-800';
      case 'Moderate':
        return 'bg-yellow-100 text-yellow-800';
      case 'Busy':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <main className="min-h-screen bg-white pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Nearby</h1>
              <p className="text-xs text-gray-500">Spots close to you</p>
            </div>
            <button className="p-2 hover:bg-gray-100 rounded-full transition">
              <Navigation className="w-5 h-5 text-purple-600" />
            </button>
          </div>

          {/* Sort Options */}
          <div className="flex gap-2">
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
              Top Rated
            </button>
          </div>
        </div>
      </header>

      {/* Location Info */}
      <div className="px-4 py-3 bg-purple-50 border-b border-purple-100">
        <div className="flex items-center gap-2 text-sm text-purple-900">
          <MapPin className="w-4 h-4" />
          <span>Your location: Chicago, IL</span>
        </div>
      </div>

      {/* Places List */}
      <section className="px-4 py-4">
        <div className="space-y-3">
          {sorted.map((place) => (
            <div
              key={place.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
            >
              <div className="flex gap-3">
                {/* Icon */}
                <div className="text-3xl flex-shrink-0">{place.image}</div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">{place.name}</h3>
                      <p className="text-xs text-gray-500">{place.category}</p>
                    </div>
                    <span className="text-xs font-bold text-purple-600 flex-shrink-0">
                      {place.distance} mi
                    </span>
                  </div>

                  {/* Rating */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-gray-900">
                      ⭐ {place.rating}
                    </span>
                    <span className="text-xs text-gray-500">({place.reviews})</span>
                  </div>

                  {/* Status */}
                  <div className="flex gap-2 flex-wrap">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${getBusyColor(place.busy)}`}>
                      {place.busy}
                    </span>
                    <span className="text-xs text-gray-600 px-2 py-1 bg-gray-100 rounded-full">
                      Until {place.openUntil}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button className="w-full mt-3 py-2 px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 text-sm font-medium rounded-lg transition">
                View Details
              </button>
            </div>
          ))}
        </div>
      </section>

      <BottomNav />
    </main>
  );
}