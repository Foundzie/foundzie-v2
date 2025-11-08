// src/app/admin/places/page.tsx
import Link from "next/link";
import { mockPlaces } from "@/app/data/places";

export default function AdminPlacesPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-semibold text-gray-900">Places</h1>
        <p className="text-sm text-gray-500">
          Listing of mock places from <code>src/app/data/places.ts</code>
        </p>
      </header>

      <div className="px-6 py-6">
        <ul className="space-y-3">
          {mockPlaces.map((place) => (
            <li
              key={place.id}
              className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {place.name}
                  {place.trending && (
                    <span className="ml-2 text-[10px] bg-yellow-100 text-yellow-800 px-2 py-[1px] rounded">
                      trending
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500">
                  {place.category}
                  {/* 👇 this was `place.distance` before — that caused the build error */}
                  {typeof place.distanceMiles === "number"
                    ? ` • ${place.distanceMiles} mi`
                    : ""}
                  {typeof place.rating === "number"
                    ? ` • ${place.rating}★`
                    : ""}
                  {typeof place.reviews === "number"
                    ? ` • ${place.reviews} reviews`
                    : ""}
                  {place.openUntil ? ` • open until ${place.openUntil}` : ""}
                </p>
              </div>
              <Link
                href={`/admin/places/${place.id}`}
                className="text-xs text-purple-600 hover:underline"
              >
                edit
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}