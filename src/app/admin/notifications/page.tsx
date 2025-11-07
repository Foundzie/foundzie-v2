// src/app/admin/notifications/page.tsx
import { mockNotifications } from '@/app/data/notifications';

export default function AdminNotificationsPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="w-full bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Notifications</h1>
          <p className="text-xs text-gray-500">
            Shared list coming from src/app/data/notifications.ts
          </p>
        </div>
        <span className="text-[10px] px-2 py-1 rounded-full bg-purple-100 text-purple-700">
            admin
        </span>
      </header>

      {/* List */}
      <section className="px-6 py-6">
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900">
              {mockNotifications.length} notifications
            </p>
            {/* later we'll put "Add notification" here */}
          </div>
          <ul className="divide-y divide-gray-100">
            {mockNotifications.map((n) => (
              <li key={n.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-900 flex items-center gap-2">
                    {n.title}
                    <span className="text-[9px] uppercase tracking-wide bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                      {n.type}
                    </span>
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{n.message}</p>
                  {n.actionLabel && (
                    <p className="text-[10px] text-purple-600 mt-1">
                      Action: {n.actionLabel} → {n.actionHref}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-400">{n.time}</p>
                  <p
                    className={`text-[10px] mt-1 ${
                      n.unread ? 'text-green-600' : 'text-gray-400'
                    }`}
                  >
                    {n.unread ? 'unread' : 'read'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}