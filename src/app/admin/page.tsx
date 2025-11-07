// src/app/admin/page.tsx
import { mockPlaces } from '@/app/data/places';
import { mockNotifications } from '@/app/data/notifications';

export default function AdminPage() {
  const totalPlaces = mockPlaces.length;
  const totalNotifications = mockNotifications.length;
  // fake number for now
  const totalUsers = 128;

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="w-full bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Foundzie Admin</h1>
          <p className="text-xs text-gray-500">
            Internal view of shared data (places, notifications)
          </p>
        </div>
        <span className="text-[10px] px-2 py-1 rounded-full bg-purple-100 text-purple-700">
          MVP
        </span>
      </header>

      {/* Stats */}
      <section className="px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Places</p>
          <p className="text-2xl font-bold text-gray-900">{totalPlaces}</p>
          <p className="text-[10px] text-gray-400">From src/app/data/places.ts</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Notifications</p>
          <p className="text-2xl font-bold text-gray-900">{totalNotifications}</p>
          <p className="text-[10px] text-gray-400">From src/app/data/notifications.ts</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Users</p>
          <p className="text-2xl font-bold text-gray-900">{totalUsers}</p>
          <p className="text-[10px] text-gray-400">Static for now</p>
        </div>
      </section>

      {/* 2 columns */}
      <section className="px-6 pb-10 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Notifications */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Latest notifications</h2>
            <span className="text-[10px] text-gray-400">
              {mockNotifications.length} total
            </span>
          </div>
          <ul className="divide-y divide-gray-100">
            {mockNotifications.map((n) => (
              <li key={n.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-gray-900">{n.title}</p>
                  <p className="text-[11px] text-gray-500">{n.message}</p>
                </div>
                <span className="text-[10px] text-gray-400">{n.time}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Places */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Places</h2>
            <span className="text-[10px] text-gray-400">
              {mockPlaces.length} total
            </span>
          </div>
          <ul className="divide-y divide-gray-100">
            {mockPlaces.map((place) => (
              <li key={place.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-gray-900">
                    {place.name}
                    {place.trending && (
                      <span className="ml-2 text-[9px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-full">
                        trending
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {place.category} • {place.distance} mi • {place.rating}★
                  </p>
                </div>
                <span className="text-[10px] text-gray-400">
                  {place.busy ?? '—'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}