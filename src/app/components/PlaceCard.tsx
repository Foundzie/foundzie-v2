// src/app/components/PlaceCard.tsx
import Link from 'next/link';
import { Place } from '@/app/data/places';

export default function PlaceCard({ place }: { place: Place }) {
  return (
    <Link
      href={`/mobile/places/${place.id}`}
      className="block border border-gray-100 rounded-xl p-4 shadow-sm hover:border-purple-200 transition bg-white"
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
  );
}
