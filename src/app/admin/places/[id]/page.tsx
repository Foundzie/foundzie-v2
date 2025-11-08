// src/app/admin/places/[id]/page.tsx

import Link from "next/link";
import { mockPlaces } from "@/app/data/places";

type AdminPlacePageProps = {
  params: {
    id: string;
  };
};

export default function AdminPlacePage({ params }: AdminPlacePageProps) {
  const { id } = params;

  // compare as strings so TS is happy and it matches your mock data
  const place = mockPlaces.find((p) => String(p.id) === String(id));

  if (!place) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <Link href="/admin/places" className="text-sm text-purple-600">
          ← Back
        </Link>
        <h1 className="text-xl font-semibold mt-4">Place not found</h1>
        <p className="text-sm text-gray-500 mt-2">
          The ID in the URL didn’t match anything in <code>src/app/data/places.ts</code>.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 space-y-6">
      <Link href="/admin/places" className="text-sm text-purple-600">
        ← Back
      </Link>

      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">{place.name}</h1>
        <p className="text-sm text-gray-500">{place.category}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {"distanceMiles" in place && place.distanceMiles ? (
            <div>
              <p className="text-xs text-gray-400">Distance</p>
              <p className="text-sm text-gray-900">{place.distanceMiles} mi</p>
            </div>
          ) : null}

          {"openUntil" in place && place.openUntil ? (
            <div>
              <p className="text-xs text-gray-400">Open until</p>
              <p className="text-sm text-gray-900">{place.openUntil}</p>
            </div>
          ) : null}

          {"rating" in place && place.rating ? (
            <div>
              <p className="text-xs text-gray-400">Rating</p>
              <p className="text-sm text-gray-900">★ {place.rating}</p>
            </div>
          ) : null}

          {"reviews" in place && place.reviews ? (
            <div>
              <p className="text-xs text-gray-400">Reviews</p>
              <p className="text-sm text-gray-900">{place.reviews}</p>
            </div>
          ) : null}
        </div>

        <div>
          <p className="text-xs text-gray-400 mb-1">Trending</p>
          <p className="text-sm text-gray-900">
            {place.trending ? "Yes" : "No"}
          </p>
        </div>
      </div>
    </main>
  );
}