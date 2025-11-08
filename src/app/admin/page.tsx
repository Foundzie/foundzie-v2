// src/app/admin/page.tsx
import Link from "next/link";
import { mockPlaces } from "@/app/data/places";
import { mockNotifications } from "@/app/data/notifications";
import { mockUsers } from "@/app/data/users";

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      {/* top bar */}
      <header className="w-full bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-semibold text-gray-900">Foundzie Admin</h1>
        <p className="text-xs text-gray-500">
          Internal view of shared data (places, notifications, users)
        </p>
      </header>

      <div className="px-6 py-6 flex flex-col gap-6">
        {/* 3 cards at the top */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Places card */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-400 mb-1">Places</p>
            <p className="text-2xl font-semibold text-gray-900">
              {mockPlaces.length}
              <span className="text-xs text-gray-400 ml-1">
                (from src/app/data/places.ts)
              </span>
            </p>
            <Link
              href="/admin/places"
              className="text-xs text-purple-600 mt-2 inline-block hover:underline"
            >
              View all →
            </Link>
          </div>

          {/* Notifications card */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-400 mb-1">Notifications</p>
            <p className="text-2xl font-semibold text-gray-900">
              {mockNotifications.length}
              <span className="text-xs text-gray-400 ml-1">
                (from src/app/data/notifications.ts)
              </span>
            </p>
            <Link
              href="/admin/notifications"
              className="text-xs text-purple-600 mt-2 inline-block hover:underline"
            >
              View all →
            </Link>
          </div>

          {/* Users card */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-400 mb-1">Users</p>
            <p className="text-2xl font-semibold text-gray-900">
              {mockUsers.length}
              <span className="text-xs text-gray-400 ml-1">
                (from src/app/data/users.ts)
              </span>
            </p>
            <Link
              href="/admin/users"
              className="text-xs text-purple-600 mt-2 inline-block hover:underline"
            >
              View all →
            </Link>
          </div>
        </section>

        {/* lower area: notifications + places side by side */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* latest notifications */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900">
                Latest notifications
              </h2>
              <Link
                href="/admin/notifications"
                className="text-[11px] text-purple-600 hover:underline"
              >
                view all
              </Link>
            </div>
            <ul className="space-y-3">
              {mockNotifications.map((n) => (
                <li key={n.id} className="border-b last:border-b-0 pb-3 last:pb-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">{n.title}</p>
                    <span className="text-[10px] uppercase text-gray-400">
                      {n.type}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{n.message}</p>
                  <p className="text-[10px] text-gray-300 mt-1">{n.time}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* places list */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900">Places</h2>
              <Link
                href="/admin/places"
                className="text-[11px] text-purple-600 hover:underline"
              >
                view all
              </Link>
            </div>
            <ul className="space-y-3">
              {mockPlaces.map((place) => (
                <li
                    key={place.id}
                    className="flex items-center justify-between border-b last:border-b-0 pb-3 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {place.name}{" "}
                      {place.trending && (
                        <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-[1px] rounded ml-1">
                          trending
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400">
                      {place.category} • {place.distance} mi • ⭐ {place.rating}
                    </p>
                  </div>
                  <Link
                    href={`/admin/places/${place.id}`}
                    className="text-[11px] text-purple-500 hover:underline"
                  >
                    edit
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}