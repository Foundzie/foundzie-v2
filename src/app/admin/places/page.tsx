// src/app/admin/places/page.tsx
import Link from "next/link";
import { mockPlaces } from "@/app/data/places";

export default function AdminPlacesPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <header className="w-full bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Places</h1>
          <p className="text-xs text-gray-500">
            Shared list coming from src/app/data/places.ts
          </p>
        </div>
        <Link
          href="/admin/places/new"
          className="bg-purple-600 text-white text-sm px-4 py-2 rounded-md hover:bg-purple-700"
        >
          + New
        </Link>
      </header>

      <section className="px-6 py-6">
        <div className="bg-white border border-gray-200 rounded-lg">
          <ul className="divide-y divide-gray-100">
            {mockPlaces.map((place) => (
              <li
                key={place.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                    {place.name}
                    {place.trending ? (
                      <span className="text-[10px] uppercase tracking-wide bg-yellow-100 text-yellow-700 px-2 py-[2px] rounded">
                        trending
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-gray-500">
                    {place.category} • {place.distance} mi • {place.rating}★ •{" "}
                    {place.reviews} reviews
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    open until {place.openUntil} • {place.busy}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/admin/places/${place.id}`}
                    className="text-xs text-purple-600 hover:underline"
                  >
                    Edit
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <Link
          href="/admin"
          className="inline-block mt-4 text-[11px] text-gray-400 hover:text-gray-600"
        >
          ← back to admin
        </Link>
      </section>
    </main>
  );
}