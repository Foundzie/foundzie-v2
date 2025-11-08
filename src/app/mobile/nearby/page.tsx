// src/app/mobile/nearby/page.tsx
import Link from "next/link";
import { mockPlaces } from "@/app/data/places";

const FILTERS = ["All", "Coffee", "Parks", "Workspaces", "Restaurants", "Events", "Shopping"];

export default function NearbyPage() {
  // sort by distanceMiles (NOT distance)
  const sorted = mockPlaces
    .slice()
    .sort(
      (a, b) =>
        (a.distanceMiles ?? Number.POSITIVE_INFINITY) -
        (b.distanceMiles ?? Number.POSITIVE_INFINITY)
    );

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="px-4 py-4 border-b border-slate-800">
        <h1 className="text-lg font-semibold">Nearby</h1>
        <p className="text-xs text-slate-400">Browse all nearby places</p>
      </header>

      {/* filters row */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto no-scrollbar">
        {FILTERS.map((f) => (
          <span
            key={f}
            className={`inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-xs text-slate-100 whitespace-nowrap`}
          >
            {f}
          </span>
        ))}
      </div>

      <ul className="px-2 pb-16">
        {sorted.map((place) => (
          <li key={place.id}>
            <Link
              href={`/mobile/places/${place.id}`}
              className="flex items-center justify-between px-2 py-3 border-b border-slate-900"
            >
              <div>
                <p className="text-sm font-medium">{place.name}</p>
                <p className="text-xs text-slate-400">{place.category}</p>
              </div>
              <div className="text-right text-[11px] text-slate-400 space-y-1">
                {/* 👇 THIS was place.distance before – now it's distanceMiles */}
                {typeof place.distanceMiles === "number" ? (
                  <p>{place.distanceMiles} mi</p>
                ) : null}
                {place.openUntil ? <p>open until {place.openUntil}</p> : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}