// src/app/mobile/places/[id]/page.tsx

import Link from "next/link";
import { mockPlaces } from "@/app/data/places";

type Place = (typeof mockPlaces)[number];

interface PlacePageProps {
  params: {
    id: string;
  };
}

export default function PlaceDetailPage({ params }: PlacePageProps) {
  // Ensure id matches regardless of type
  const place = mockPlaces.find(
    (p) => String(p.id) === String(params.id)
  );

  if (!place) {
    return (
      <main className="min-h-screen bg-slate-950 text-white p-6">
        <Link href="/mobile" className="text-sm text-slate-400">
          ← Back
        </Link>
        <h1 className="mt-6 text-lg font-semibold">Place not found</h1>
        <p className="text-slate-400 text-sm mt-2">
          The ID in the URL didn’t match any mock data in `places.ts`.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6 space-y-6">
      <Link href="/mobile" className="text-sm text-slate-400">
        ← Back
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">{place.name}</h1>
        <p className="text-slate-400">{place.category}</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-900 p-4 rounded-lg">
          <p className="text-xs text-slate-400 mb-1">Distance</p>
          <p className="text-base">
            {place.distanceMiles ? `${place.distanceMiles} mi` : "—"}
          </p>
        </div>

        <div className="bg-slate-900 p-4 rounded-lg">
          <p className="text-xs text-slate-400 mb-1">Rating</p>
          <p className="text-base">
            {place.rating ? `${place.rating} ⭐` : "—"}
          </p>
        </div>

        <div className="bg-slate-900 p-4 rounded-lg">
          <p className="text-xs text-slate-400 mb-1">Open Until</p>
          <p className="text-base">
            {place.openUntil ? place.openUntil : "—"}
          </p>
        </div>
      </div>

      <button className="w-full bg-fuchsia-500 hover:bg-fuchsia-600 transition rounded-md py-3 text-center text-sm font-medium">
        Get directions (mock)
      </button>
    </main>
  );
}