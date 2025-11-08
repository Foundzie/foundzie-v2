// src/app/mobile/places/[id]/page.tsx

import Link from "next/link";
import { mockPlaces } from "@/app/data/places";

export default function PlaceDetailPage({ params }: { params: any }) {
  const rawId =
    params && typeof params === "object" && "id" in params ? params.id : "";
  const id = String(rawId);

  // 1) try exact ID match first
  let place = mockPlaces.find((p: any) => String(p.id) === id) as any;

  // 2) if that didn't work, try treating the id as "1 = first item, 2 = second item..."
  if (!place) {
    const idx = Number(id) - 1;
    if (!Number.isNaN(idx) && idx >= 0 && idx < mockPlaces.length) {
      place = mockPlaces[idx] as any;
    }
  }

  if (!place) {
    // still nothing? show the friendly message
    return (
      <main className="min-h-screen bg-slate-950 text-white p-6">
        <Link href="/mobile" className="text-sm text-slate-400">
          ← Back
        </Link>
        <h1 className="mt-6 text-lg font-semibold">Place not found</h1>
        <p className="text-slate-400 text-sm mt-2">
          The ID in the URL didn&apos;t match any mock data in
          {" "}
          <code>src/app/data/places.ts</code>.
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
          <p className="text-xs text-slate-400 mb-1">Open until</p>
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