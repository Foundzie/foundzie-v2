'use client';

import { Heart, MapPin, Star } from 'lucide-react';
import { useState } from 'react';
import type { Place } from '@/app/data/places'; // ← use the Place from your data file

interface PlaceCardProps {
  place: Place;
}

export default function PlaceCard({ place }: PlaceCardProps) {
  const [isSaved, setIsSaved] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
      <div className="flex gap-3">
        {/* Icon */}
        <div className="text-3xl flex-shrink-0">
          {/* image might be missing, so fall back */}
          {place.image ? place.image : '📍'}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900 text-sm">
                  {place.name}
                </h3>
                {place.trending && (
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-medium">
                    Trending
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">{place.category}</p>
            </div>

            <button
              onClick={() => setIsSaved(!isSaved)}
              className="flex-shrink-0 p-1 hover:bg-gray-100 rounded transition"
            >
              <Heart
                className={`w-5 h-5 ${
                  isSaved
                    ? 'fill-red-500 text-red-500'
                    : 'text-gray-400 hover:text-red-500'
                }`}
              />
            </button>
          </div>

          {/* Description */}
          <p className="text-xs text-gray-600 mb-2">{place.description}</p>

          {/* Rating & Distance */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                <span className="text-xs font-semibold text-gray-900">
                  {place.rating}
                </span>
              </div>
              <span className="text-xs text-gray-500">({place.reviews})</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-purple-600 font-semibold">
              <MapPin className="w-3 h-3" />
              {place.distance} mi
            </div>
          </div>
        </div>
      </div>

      {/* CTA Button */}
      <button className="w-full mt-3 py-2 px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 text-sm font-medium rounded-lg transition">
        View Details
      </button>
    </div>
  );
}
