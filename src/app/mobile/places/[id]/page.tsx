// src/app/mobile/places/[id]/page.tsx
import Link from "next/link";
import { mockPlaces } from "@/app/data/places";
import MobileSaveButton from "@/app/components/MobileSaveButton";

export default async function MobilePlaceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;

  const place = mockPlaces.find((p) => p.id.toString() === id);

  if (!place) {
    return (
      <main className="min-h-screen bg-slate-950 text-white p-4">
        <Link href="/mobile" className="text-pink-400 underline text-sm">
          ← Back
        </Link>
        <p className="mt-4 text-slate-400">Place not found.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 space-y-6">
      <header className="flex justify-between items-center mb-4">
        <Link href="/mobile" className="text-pink-400 underline text-sm">
          ← Back
        </Link>
        <MobileSaveButton placeId={id} />
      </header>

      <div>
        <h1 className="text-xl font-bold mb-2">{place.name}</h1>
        <p className="text-slate-400 text-sm mb-1">{place.category}</p>
        {place.distanceMiles !== undefined && (
          <p className="text-slate-300 text-xs mb-2">
            {place.distanceMiles} mi • open until {place.openUntil}
          </p>
        )}
        {place.description ? (
          <p className="text-slate-200 text-sm">{place.description}</p>
        ) : null}
      </div>
    </main>
  );
}