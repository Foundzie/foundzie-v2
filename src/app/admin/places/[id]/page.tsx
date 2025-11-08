// src/app/admin/places/[id]/page.tsx
import Link from "next/link";
import { mockPlaces } from "@/app/data/places";

export default async function AdminEditPlacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const place = mockPlaces.find((p) => p.id === Number(id));

  if (!place) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white border border-gray-200 rounded-lg px-6 py-8 text-center">
          <p className="text-sm text-gray-600 mb-4">
            Place with id {id} not found (mock data).
          </p>
          <Link
            href="/admin/places"
            className="text-xs text-purple-600 hover:underline"
          >
            ← back to places
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="w-full bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Edit place: {place.name}
          </h1>
          <p className="text-xs text-gray-500">
            This matches our mock data shape in src/app/data/places.ts
          </p>
        </div>
        <Link
          href="/admin/places"
          className="text-[10px] text-gray-400 hover:text-gray-600"
        >
          ← back to places
        </Link>
      </header>

      <section className="px-6 py-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-xl">
          <div className="grid gap-4">
            <label className="text-xs text-gray-700">
              Name
              <input
                defaultValue={place.name}
                className="mt-1 w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
              />
            </label>

            <label className="text-xs text-gray-700">
              Category
              <select
                defaultValue={place.category}
                className="mt-1 w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
              >
                <option>Coffee</option>
                <option>Parks</option>
                <option>Restaurants</option>
                <option>Workspace</option>
                <option>Events</option>
                <option>Shopping</option>
              </select>
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="text-xs text-gray-700">
                Distance (miles)
                <input
                  defaultValue={place.distance}
                  type="number"
                  step="0.1"
                  className="mt-1 w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs text-gray-700">
                Reviews
                <input
                  defaultValue={place.reviews}
                  type="number"
                  className="mt-1 w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                />
              </label>
            </div>

            <label className="text-xs text-gray-700">
              Description
              <textarea
                defaultValue={place.description}
                rows={3}
                className="mt-1 w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
              />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="text-xs text-gray-700">
                Open until
                <input
                  defaultValue={place.openUntil}
                  className="mt-1 w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs text-gray-700">
                Busy level
                <select
                  defaultValue={place.busy}
                  className="mt-1 w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                >
                  <option>Quiet</option>
                  <option>Moderate</option>
                  <option>Busy</option>
                </select>
              </label>
            </div>
          </div>

          <p className="text-[10px] text-gray-400 mt-4 mb-2">
            Note: this is just a mock form right now — to actually save we’ll
            connect it to a backend (Supabase / API route).
          </p>

          <button className="mt-2 bg-purple-600 text-white px-4 py-2 rounded-md text-sm hover:bg-purple-700">
            Save (mock)
          </button>
        </div>
      </section>
    </main>
  );
}