// src/app/admin/places/page.tsx
import Link from "next/link";
import { mockPlaces } from "@/app/data/places";

export default function AdminPlacesPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Places</h1>
          <p className="text-slate-400 text-sm">
            Showing {mockPlaces.length} places from src/app/data/places.ts
          </p>
        </div>
      </header>

      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Rating</th>
              <th className="px-4 py-3">Open until</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {mockPlaces.map((place) => (
              <tr key={place.id} className="border-t border-slate-800">
                <td className="px-4 py-3">{place.name}</td>
                <td className="px-4 py-3">{place.category}</td>
                <td className="px-4 py-3">{place.rating}</td>
                <td className="px-4 py-3">{place.openUntil}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/places/${place.id}`}
                    className="text-pink-400 hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {mockPlaces.length === 0 && (
              <tr>
                <td className="px-4 py-4 text-slate-400" colSpan={5}>
                  No places found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}