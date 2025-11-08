// src/app/admin/places/[id]/page.tsx
import Link from "next/link";
import { mockPlaces } from "@/app/data/places";

type AdminPlacePageProps = {
  // in this project params is a Promise, so we await it
  params: Promise<{ id: string }>;
};

export default async function AdminPlacePage({ params }: AdminPlacePageProps) {
  const { id } = await params;

  // ids in your mockPlaces are strings, so compare as strings
  const place = mockPlaces.find((p) => p.id === id);

  if (!place) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 p-6 space-y-4">
        <Link href="/admin/places" className="text-sm underline">
          ← Back
        </Link>
        <p>Place not found. The ID in the URL didn’t match anything in src/app/data/places.ts.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-slate-400 mb-1">Admin · Place detail</p>
          <h1 className="text-2xl font-semibold">{place.name}</h1>
          <p className="text-sm text-slate-400">
            {place.category}
            {place.distanceMiles !== undefined ? ` • ${place.distanceMiles} mi` : ""}
          </p>
        </div>
        <Link
          href="/admin/places"
          className="text-sm px-3 py-1 rounded bg-slate-800 hover:bg-slate-700"
        >
          Back to places
        </Link>
      </div>

      <section className="bg-slate-900 rounded-lg p-4 space-y-3">
        <h2 className="text-lg font-medium">Basics</h2>
        <div className="grid gap-2 text-sm">
          <p>
            <span className="text-slate-400 mr-2">ID:</span>
            {place.id}
          </p>
          <p>
            <span className="text-slate-400 mr-2">Category:</span>
            {place.category}
          </p>
          <p>
            <span className="text-slate-400 mr-2">Open until:</span>
            {place.openUntil ?? "—"}
          </p>
          <p>
            <span className="text-slate-400 mr-2">Trending:</span>
            {place.trending ? "Yes" : "No"}
          </p>
        </div>
      </section>

      <section className="bg-slate-900 rounded-lg p-4 space-y-3">
        <h2 className="text-lg font-medium">Metrics</h2>
        <div className="grid gap-2 text-sm">
          <p>
            <span className="text-slate-400 mr-2">Distance:</span>
            {place.distanceMiles !== undefined ? `${place.distanceMiles} mi` : "—"}
          </p>
          <p>
            <span className="text-slate-400 mr-2">Rating:</span>
            {place.rating ?? "—"}
          </p>
          <p>
            <span className="text-slate-400 mr-2">Reviews:</span>
            {place.reviews ?? "—"}
          </p>
        </div>
      </section>
    </main>
  );
}