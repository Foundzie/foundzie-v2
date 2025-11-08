// src/app/admin/places/[id]/page.tsx
import Link from "next/link";
import { mockPlaces } from "@/app/data/places";

export default function AdminPlacePage({
  params,
}: {
  params: { id: string };
}) {
  // params.id is already a string
  const place = mockPlaces.find((p) => p.id === params.id);

  if (!place) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <Link href="/admin/places" className="text-xs text-purple-600 hover:underline">
          ← back
        </Link>
        <p className="mt-4 text-sm text-red-600">
          Place not found. The ID in the URL didn&apos;t match anything in
          src/app/data/places.ts.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Admin · {place.name}
          </h1>
          <p className="text-xs text-gray-500">ID: {place.id}</p>
        </div>
        <Link href="/admin/places" className="text-xs text-purple-600 hover:underline">
          ← back to list
        </Link>
      </header>

      <div className="p-6 space-y-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
          <p className="text-sm">
            <span className="font-medium">Name:</span> {place.name}
          </p>
          <p className="text-sm">
            <span className="font-medium">Category:</span> {place.category}
          </p>
          <p className="text-sm">
            <span className="font-medium">Distance:</span> {place.distanceMiles} mi
          </p>
          <p className="text-sm">
            <span className="font-medium">Rating:</span> {place.rating} ⭐
          </p>
          <p className="text-sm">
            <span className="font-medium">Reviews:</span> {place.reviews}
          </p>
          <p className="text-sm">
            <span className="font-medium">Open until:</span> {place.openUntil}
          </p>
          <p className="text-sm">
            <span className="font-medium">Trending:</span>{" "}
            {place.trending ? "Yes" : "No"}
          </p>
          {place.description ? (
            <p className="text-sm">
              <span className="font-medium">Description:</span>{" "}
              {place.description}
            </p>
          ) : null}
        </div>

        <p className="text-[11px] text-gray-500">Admin view from mock data.</p>
      </div>
    </main>
  );
}