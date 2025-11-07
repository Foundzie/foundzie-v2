// src/app/admin/page.tsx
import Link from "next/link";
import { mockPlaces } from "@/app/data/places";
import { mockNotifications } from "@/app/data/notifications";

export default function AdminDashboardPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="w-full bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Foundzie Admin</h1>
          <p className="text-xs text-gray-500">
            Internal view of shared data (places, notifications).
          </p>
        </div>
        <span className="text-[10px] px-2 py-1 rounded-full bg-purple-100 text-purple-700">
          admin
        </span>
      </header>

      {/* Top cards */}
      <section className="px-6 py-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Places card */}
        <Link
          href="/admin/places"
          className="bg-white border border-gray-200 rounded-lg p-4 hover:border-purple-200 hover:shadow-sm transition"
        >
          <p className="text-[10px] text-gray-400 mb-1">
            from src/app/data/places.ts
          </p>
          <h2 className="text-2xl font-semibold text-gray-900">
            {mockPlaces.length}
          </h2>
          <p className="text-xs text-gray-500">Places</p>
        </Link>

        {/* Notifications card */}
        <Link
          href="/admin/notifications"
          className="bg-white border border-gray-200 rounded-lg p-4 hover:border-purple-200 hover:shadow-sm transition"
        >
          <p className="text-[10px] text-gray-400 mb-1">
            from src/app/data/notifications.ts
          </p>
          <h2 className="text-2xl font-semibold text-gray-900">
            {mockNotifications.length}
          </h2>
          <p className="text-xs text-gray-500">Notifications</p>
        </Link>

        {/* Users card (placeholder) */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-[10px] text-gray-400 mb-1">static for now</p>
          <h2 className="text-2xl font-semibold text-gray-900">128</h2>
          <p className="text-xs text-gray-500">Users</p>
        </div>
      </section>

      {/* Latest notifications + places preview */}
      <section className="px-6 pb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Latest notifications */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900">Latest notifications</p>
            <Link href="/admin/notifications" className="text-[10px] text-purple-600">
              view all
            </Link>
          </div>
          <ul className="divide-y divide-gray-100">
            {mockNotifications.slice(0, 3).map((n) => (
              <li key={n.id} className="px-4 py-3">
                <p className="text-xs font-semibold text-gray-900">{n.title}</p>
                <p className="text-[11px] text-gray-500">{n.message}</p>
                <p className="text-[10px] text-gray-400 mt-1">{n.time}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* Places preview */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900">Places</p>
            <Link href="/admin/places" className="text-[10px] text-purple-600">
              view all
            </Link>
          </div>
          <ul className="divide-y divide-gray-100">
            {mockPlaces.map((p) => (
              <li key={p.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-900">{p.name}</p>
                  <p className="text-[10px] text-gray-400">
                    {p.category} • {p.distance} mi • {p.rating}★
                  </p>
                </div>
                <p className="text-[10px] text-gray-400">{p.busy}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}