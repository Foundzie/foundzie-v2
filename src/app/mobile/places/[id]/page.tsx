// src/app/mobile/places/[id]/page.tsx

import Link from "next/link";
import { mockPlaces } from "@/app/data/places";

export default function MobilePlacePage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;

  const place = mockPlaces.find((p) => String(p.id) === String(id));

  if (!place) {
    return (
      <main className="min-h-screen bg-slate-950 text-white p-4 space-y-4">
        <Link href="/mobile" className="text-sm text-purple-200">
          ← back
        </Link>
        <h1 className="text-lg font-semibold">Place not found</h1>
        <p className="text-sm text-slate-400">
          The ID in the URL didn&apos;t match any mock data in
          {" "}
          <code>src/app/data/places.ts</code>.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 space-y-4">
      <Link href="/mobile" className="text-sm text-purple-200">
        ← back
      </Link>

      <div className="bg-slate-900 rounded-lg p-4 space-y-3">
        <h1 className="text-xl font-semibold">{place.name}</h1>
        <p className="text-sm text-slate-400">{place.category}</p>

        <div className="grid grid-cols-2 gap-3">
          {place.distanceMiles ? (
            <div>
              <p className="text-xs text-slate-500">Distance</p>
              <p className="text-sm">{place.distanceMiles} mi</p>
            </div>
          ) : null}

          {place.openUntil ? (
            <div>
              <p className="text-xs text-slate-500">Open until</p>
              <p className="text-sm">{place.openUntil}</p>
            </div>
          ) : null}

          {typeof place.rating === "number" ? (
            <div>
              <p className="text-xs text-slate-500">Rating</p>
              <p className="text-sm">★ {place.rating}</p>
            </div>
          ) : null}

          {typeof place.reviews === "number" ? (
            <div>
              <p className="text-xs text-slate-500">Reviews</p>
              <p className="text-sm">{place.reviews}</p>
            </div>
          ) : null}
        </div>

        <div>
          <p className="text-xs text-slate-500 mb-1">Trending</p>
          <p className="text-sm">{place.trending ? "Yes" : "No"}</p>
        </div>
      </div>
    </main>
  );
}
