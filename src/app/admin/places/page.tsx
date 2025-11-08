// src/app/admin/places/page.tsx
import Link from "next/link";
import { mockPlaces } from "@/app/data/places";

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
        <div className="flex items-center gap-2">
          <Link
            href="/admin"
            className="text-[10px] text-gray-400 hover:text-gray-600"
          >
            ← back to admin
          </Link>
          <Link
            href="/admin/places/new"
            className="text-[11px] bg-purple-600 text-white px-3 py-1.5 rounded-md hover:bg-purple-700 transition"
          >
            + New
          </Link>
        </div>
      </header>

      {/* List */}
      <section className="px-6 py-6">
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900">
              {mockPlaces.length} places
            </p>
            <p className="text-[10px] text-gray-400">
              (editing is mocked for now)
            </p>
          </div>
          <ul className="divide-y divide-gray-100">
            {mockPlaces.map((p) => (
              <li
                key={p.id}
                className="px-4 py-3 flex items-center justify-between gap-4"
              >
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-900">
                    {p.name}{" "}
                    {p.trending && (
                      <span className="ml-1 text-[9px] uppercase tracking-wide bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
                        trending
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {p.category} • {p.distance} mi • ⭐ {p.rating} •{" "}
                    {p.reviews} reviews
                  </p>
                  <p className="text-[10px] text-gray-400">{p.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-400">
                    open until {p.openUntil || "N/A"}
                  </p>
                  <p
                    className={`text-[10px] mt-1 ${
                      p.busy === "Busy"
                        ? "text-red-500"
                        : p.busy === "Quiet"
                        ? "text-green-500"
                        : "text-yellow-500"
                    }`}
                  >
                    {p.busy}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}