'use client';

import BottomNav from '../../components/BottomNav';
import { mockNotifications } from '@/app/data/notifications';
import { appMeta } from '@/app/data/appMeta';

export default function NotificationsPage() {
  return (
    <main className="min-h-screen bg-white pb-20">
      <p className="px-4 pt-3 text-[10px] text-gray-400">
        Data last updated: {appMeta.lastDataUpdate} • {appMeta.source} • {appMeta.version}
      </p>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 py-3">
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <p className="text-xs text-gray-500">Updates from Foundzie</p>
      </header>

      {/* List */}
      <section className="px-4 py-4 space-y-3">
        {mockNotifications.map((n) => (
          <div
            key={n.id}
            className="border border-gray-100 rounded-lg p-3 bg-white shadow-sm/5"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {n.title}
                </p>
                <p className="text-xs text-gray-600 mt-1">{n.message}</p>
                <p className="text-[10px] text-gray-400 mt-2">{n.time}</p>
              </div>
              {n.unread && (
                <span className="w-2 h-2 rounded-full bg-purple-500 mt-1" />
              )}
            </div>
            {n.actionLabel && (
              <button className="mt-3 text-xs text-purple-600 font-medium">
                {n.actionLabel}
              </button>
            )}
          </div>
        ))}
      </section>

      <BottomNav />
    </main>
  );
}