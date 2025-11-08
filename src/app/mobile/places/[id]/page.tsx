import Link from "next/link";
import { mockPlaces } from "@/app/data/places";

type Place = (typeof mockPlaces)[number] & {
  distanceMiles?: number;
  openUntil?: string;
};

export default function MobilePlaceDetail({
  params,
}: {
  params: { id: string };
}) {
  const place = (mockPlaces as Place[]).find((p) => p.id === params.id);

  if (!place) {
    return (
      <main className="min-h-screen bg-[#0f172a] text-white p-4">
        <Link href="/mobile" className="text-sm text-slate-300">
          ← back
        </Link>
        <p className="mt-6 font-semibold">Place not found</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0f172a] text-white pb-16">
      {/* top bar */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800">
        <Link href="/mobile" className="text-sm text-slate-300">
          back
        </Link>
      </div>

      {/* content */}
      <div className="px-4 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-semibold">{place.name}</h1>
          <p className="text-sm text-slate-300">{place.category}</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-900/40 rounded-lg p-3">
            <p className="text-[0.65rem] text-slate-400">Distance</p>
            <p className="text-base font-medium">
              {place.distanceMiles ? `${place.distanceMiles} mi` : "—"}
            </p>
          </div>
          <div className="bg-slate-900/40 rounded-lg p-3">
            <p className="text-[0.65rem] text-slate-400">Rating</p>
            <p className="text-base font-medium">
              {place.rating ? `${place.rating} ★` : "—"}
            </p>
          </div>
          <div className="bg-slate-900/40 rounded-lg p-3">
            <p className="text-[0.65rem] text-slate-400">Reviews</p>
            <p className="text-base font-medium">
              {place.reviews ? place.reviews : "—"}
            </p>
          </div>
        </div>

        <div className="bg-slate-900/40 rounded-lg p-4 space-y-2 text-sm">
          <p className="text-slate-200">
            {place.description || "Nice place nearby."}
          </p>
          <p className="text-slate-400 text-xs">
            {place.openUntil ? `Open until ${place.openUntil}` : "Hours vary"}
          </p>
        </div>
      </div>

      {/* bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-4 bg-[#0f172a]">
        <button className="w-full bg-fuchsia-500 rounded-lg py-3 text-sm font-medium text-white">
          Get directions (mock)
        </button>
      </div>
    </main>
  );
}