// src/app/mobile/places/[id]/page.tsx
import Link from "next/link";
import { mockPlaces } from "@/app/data/places";

// This is the shape Next gives us for a route like /mobile/places/[id]
type MobilePlaceDetailPageProps = {
  params: {
    id: string;
  };
};

export default function MobilePlaceDetailPage({ params }: MobilePlaceDetailPageProps) {
  const { id } = params; // route param is always a string

  // make sure we also compare as strings
  const place = mockPlaces.find((p) => p.id.toString() === id);

  // if the id in the URL didn't match anything, show a friendly message
  if (!place) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 p-4 space-y-4">
        <Link href="/mobile" className="text-pink-400 underline text-sm">
          ← Back to list
        </Link>
        <p className="text-xl font-semibold">Place not found</p>
        <p className="text-sm text-slate-400">
          Check <code>src/app/data/places.ts</code> for available IDs.
        </p>
      </main>
    );
  }

  // normal detail view
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-4 space-y-6">
      <header className="flex items-center justify-between gap-3">
        <Link href="/mobile" className="text-pink-400 underline text-sm">
          ← Back
        </Link>
        <h1 className="text-xl font-bold">{place.name}</h1>
      </header>

      <section className="space-y-2 text-sm">
        <p className="text-slate-300">{place.category}</p>
        <p className="text-slate-400">
          {place.distanceMiles !== undefined ? `${place.distanceMiles} mi • ` : ""}
          open until {place.openUntil}
        </p>
        <p className="text-slate-200">{place.description}</p>
      </section>
    </main>
  );
}