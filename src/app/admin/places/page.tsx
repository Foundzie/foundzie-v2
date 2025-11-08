// src/app/admin/places/page.tsx
import Link from "next/link";
import { mockPlaces } from "@/app/data/places";

export default function AdminPlacesPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Places</h1>
          <p className="text-xs text-gray-500">
            Viewing {mockPlaces.length} places (from src/app/data/places.ts)
          </p>
        </div>
        <Link
          href="/admin/places/new"
          className="inline-flex items-center rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700"
        >
          + Add place
        </Link>
      </header>

      <div className="p-6 space-y-3">
        {mockPlaces.map((place) => (
          <div
            key={place.id}
            className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between"
          >
            <div>
              <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                {place.name}
                {place.trending ? (
                  <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-[2px] rounded-full">
                    trending
                  </span>
                ) : null}
              </p>
              <p className="text-xs text-gray-500">
                {place.category} • {place.distanceMiles} mi • ⭐ {place.rating} ({place.reviews} reviews)
              </p>
            </div>
            <Link
              href={`/admin/places/${place.id}`}
              className="text-xs text-purple-600 hover:underline"
            >
              edit
            </Link>
          </div>
        ))}
      </div>
    </main>
  );
}