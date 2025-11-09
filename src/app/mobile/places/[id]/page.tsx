// src/app/mobile/places/[id]/page.tsx
import Link from "next/link";
import { mockPlaces } from "@/app/data/places";

export default function MobilePlaceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = params.id; // string from the URL

  // force both sides to string so TS stops complaining
  const place = mockPlaces.find((p) => String(p.id) === id);

  if (!place) {
    return (
      <main className="min-h-screen bg-slate-950 text-white p-4">
        <p className="mb-4 text-sm">Place not found.</p>
        <Link href="/mobile" className="text-pink-400 underline text-sm">
          ← Back to list
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 space-y-4">
      <Link href="/mobile" className="text-pink-400 underline text-sm">
        ← Back
      </Link>

      <header>
        <h1 className="text-xl font-bold">{place.name}</h1>
        <p className="text-sm text-slate-400">{place.category}</p>
      </header>

      <section className="space-y-2 text-sm">
        <p>
          <span className="font-medium">Distance:</span>{" "}
          {place.distanceMiles} mi
        </p>
        <p>
          <span className="font-medium">Open until:</span> {place.openUntil}
        </p>
        <p>
          <span className="font-medium">Rating:</span> {place.rating}
        </p>
        <p>
          <span className="font-medium">Reviews:</span> {place.reviews}
        </p>
        <p>
          <span className="font-medium">Trending:</span>{" "}
          {place.trending ? "Yes" : "No"}
        </p>
        {place.description ? (
          <p>
            <span className="font-medium">Description:</span>{" "}
            {place.description}
          </p>
        ) : null}
      </section>
    </main>
  );
}