// src/app/mobile/explore/page.tsx
import Link from "next/link";
import { mockPlaces } from "@/app/data/places";

export default function MobileExplorePage() {
  return (
    <main className="min-h-screen bg-[#0f172a] text-white pb-14">
      <header className="px-4 pt-5 pb-3">
        <h1 className="text-lg font-semibold">Explore</h1>
        <p className="text-sm text-slate-300">Browse all nearby places</p>
      </header>

      {/* categories (fake for now) */}
      <div className="px-4 mb-4 grid grid-cols-3 gap-3">
        <div className="bg-slate-800 rounded-xl p-3 text-center">
          <p className="text-sm">Coffee</p>
          <p className="text-xs text-slate-400">24</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-3 text-center">
          <p className="text-sm">Parks</p>
          <p className="text-xs text-slate-400">18</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-3 text-center">
          <p className="text-sm">Workspaces</p>
          <p className="text-xs text-slate-400">6</p>
        </div>
      </div>

      {/* list */}
      <div className="px-4 space-y-1">
        {mockPlaces.map((place) => (
          <Link
            key={place.id}
            href={`/mobile/places/${place.id}`}
            className="flex items-center justify-between py-3 border-b border-slate-800"
          >
            <div>
              <p className="font-medium">{place.name}</p>
              <p className="text-xs text-slate-400">{place.category}</p>
            </div>
            <div className="text-right text-xs text-slate-400 space-y-1">
              {place.distanceMiles ? <p>{place.distanceMiles} mi</p> : null}
              {place.openUntil ? <p>open until {place.openUntil}</p> : null}
            </div>
          </Link>
        ))}
      </div>

      {/* bottom nav (same as Home) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0f172a] border-t border-slate-800 flex justify-around py-2 text-xs text-slate-300">
        <Link href="/mobile">Home</Link>
        <Link href="/mobile/explore" className="text-white">
          Explore
        </Link>
        <Link href="/mobile/notifications">Alerts</Link>
        <Link href="/mobile/profile">Profile</Link>
        <Link href="/admin">Admin</Link>
      </nav>
    </main>
  );
}