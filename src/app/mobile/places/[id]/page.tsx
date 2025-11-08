// @ts-nocheck
import Link from "next/link";
import { mockPlaces } from "@/app/data/places";

export default function MobilePlaceDetailPage({ params }: { params: { id: string } }) {
  const place = mockPlaces.find((p: any) => {
    const rawId = p.id;
    if (String(rawId) === String(params.id)) return true;
    if (Number(rawId) === Number(params.id)) return true;
    return false;
  });

  if (!place) {
    return (
      <main className="min-h-screen bg-slate-950 text-white p-4">
        <Link href="/mobile" className="text-sm text-slate-300">
          ← back
        </Link>
        <p className="mt-6 text-base font-medium">Place not found</p>
        <p className="mt-2 text-sm text-slate-400">
          (The ID in the URL didn’t match anything in src/app/data/places.ts.)
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 space-y-6">
      <Link href="/mobile" className="text-sm text-slate-300">
        ← back
      </Link>

      <header className="space-y-1">
        <h1 className="text-xl font-semibold">{place.name}</h1>
        <p className="text-sm text-slate-400">{place.category}</p>
      </header>

      <section className="grid grid-cols-3 gap-3">
        <div className="bg-slate-900 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">Distance</p>
          <p className="text-base">
            {"distanceMiles" in place && place.distanceMiles
              ? `${place.distanceMiles} mi`
              : "—"}
          </p>
        </div>
        <div className="bg-slate-900 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">Rating</p>
          <p className="text-base">
            {"rating" in place && place.rating ? place.rating : "—"} ⭐
          </p>
        </div>
        <div className="bg-slate-900 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">Open</p>
          <p className="text-base">
            {"openUntil" in place && place.openUntil
              ? `until ${place.openUntil}`
              : "—"}
          </p>
        </div>
      </section>

      <button className="w-full bg-fuchsia-500 hover:bg-fuchsia-600 transition rounded-md py-3 text-center text-sm font-medium">
        Get directions (mock)
      </button>
    </main>
  );
}
