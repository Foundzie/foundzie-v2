// src/app/mobile/places/[id]/page.tsx
import mockPlaces from '@/app/data/places';
import Link from 'next/link';

interface PlacePageProps {
  params: {
    id: string;
  };
}

export default function PlaceDetailPage({ params }: PlacePageProps) {
  const place = mockPlaces.find((p) => p.id === Number(params.id));

  if (!place) {
    return (
      <main className="min-h-screen bg-white p-6">
        <p className="text-sm text-gray-500 mb-4">
          Place not found.
        </p>
        <Link href="/mobile/explore" className="text-purple-600 text-sm underline">
          ← back to explore
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white pb-20">
      <header className="px-4 py-4 border-b border-gray-100 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">{place.name}</h1>
        <Link href="/mobile/explore" className="text-purple-600 text-sm underline">
          back
        </Link>
      </header>

      <section className="px-4 py-4 space-y-3">
        <p className="text-sm text-gray-500">{place.category}</p>
        <p className="text-sm text-gray-700">{place.description}</p>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Distance</p>
            <p className="text-lg font-semibold text-gray-900">{place.distance} mi</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Rating</p>
            <p className="text-lg font-semibold text-gray-900">
              {place.rating.toFixed(1)} ★
            </p>
            <p className="text-[10px] text-gray-400">{place.reviews} reviews</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Open until</p>
            <p className="text-sm font-medium text-gray-900">{place.openUntil}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Busy level</p>
            <p className="text-sm font-medium text-gray-900 capitalize">{place.busy}</p>
          </div>
        </div>

        <div className="pt-4">
          <button className="w-full bg-purple-600 text-white py-3 rounded-lg text-sm font-medium">
            Get directions (mock)
          </button>
        </div>
      </section>
    </main>
  );
}