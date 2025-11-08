// src/app/mobile/places/[id]/page.tsx
import Link from "next/link";
import { mockPlaces } from "@/app/data/places";

type MobilePlacePageProps = {
  // in this project, params is a Promise
  params: Promise<{ id: string }>;
};

export default async function MobilePlacePage({ params }: MobilePlacePageProps) {
  const { id } = await params;

  // ids in mockPlaces are strings, so compare strings
  const place = mockPlaces.find((p) => p.id === id);

  if (!place) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 p-4 space-y-4">
        <Link href="/mobile" className="text-sm underline">
          ← Back
        </Link>
        <h1 className="text-xl font-semibold">Place not found</h1>
        <p className="text-sm text-slate-400">
          The ID in the URL didn’t match any mock data in <code>src/app/data/places.ts</code>.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-4 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400 mb-1">Place detail</p>
          <h1 className="text-2xl font-semibold">{place.name}</h1>
          <p className="text-sm text-slate-400">
            {place.category}
            {place.distanceMiles !== undefined ? ` • ${place.distanceMiles} mi` : ""}
          </p>
        </div>
        <Link
          href="/mobile"
          className="text-sm px-3 py-1 rounded bg-slate-800 hover:bg-slate-700"
        >
          Back
        </Link>
      </header>

      <section className="bg-slate-900 rounded-lg p-4 space-y-2 text-sm">
        <p>
          <span className="text-slate-400 mr-2">Open until:</span>
          {place.openUntil ?? "—"}
        </p>
        <p>
          <span className="text-slate-400 mr-2">Rating:</span>
          {place.rating ?? "—"}
        </p>
        <p>
          <span className="text-slate-400 mr-2">Reviews:</span>
          {place.reviews ?? "—"}
        </p>
        <p>
          <span className="text-slate-400 mr-2">Trending:</span>
          {place.trending ? "Yes" : "No"}
        </p>
      </section>
    </main>
  );
}