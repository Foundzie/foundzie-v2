// src/app/admin/places/page.tsx
import { mockPlaces } from "@/app/data/places";
import Link from "next/link";

export default function AdminPlacesPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="w-full bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Places</h1>
          <p className="text-xs text-gray-500">
            Shared list coming from src/app/data/places.ts
          </p>
        </div>
        <Link
          href="/admin"
          className="text-[10px] text-purple-600 hover:underline"
        >
          ← back to admin
        </Link>
      </header>

      {/* Table-ish list */}
      <section className="px-6 py-6">
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900">
              {mockPlaces.length} places
            </p>
            {/* later: add "New place" button here */}
          </div>
          <ul className="divide-y divide-gray-100">
            {mockPlaces.map((place) => (
              <li
                key={place.id}
                className="px-4 py-3 flex items-center justify-between gap-4"
              >
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-900 flex items-center gap-2">
                    {place.name}
                    {place.trending && (
                      <span className="text-[9px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
                        trending
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {place.category} • {place.distance} mi • {place.rating}★ •{" "}
                    {place.reviews} reviews
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {place.description}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-400">
                    open until {place.openUntil}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1">{place.busy}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}