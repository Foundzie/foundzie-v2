// src/app/admin/notifications/page.tsx
import Link from "next/link";
import { mockNotifications } from "@/app/data/notifications";

export default function AdminNotificationsPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <header className="w-full bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Notifications</h1>
          <p className="text-xs text-gray-500">
            Shared list coming from src/app/data/notifications.ts
          </p>
        </div>
        <Link
          href="/admin/notifications/new"
          className="bg-purple-600 text-white text-sm px-4 py-2 rounded-md hover:bg-purple-700"
        >
          + New
        </Link>
      </header>

      <section className="px-6 py-6">
        <div className="bg-white border border-gray-200 rounded-lg">
          <ul className="divide-y divide-gray-100">
            {mockNotifications.map((n) => (
              <li
                key={n.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                    {n.title}
                    <span className="text-[10px] uppercase tracking-wide bg-gray-100 text-gray-600 px-2 py-[2px] rounded">
                      {n.type}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500">{n.message}</p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {n.time} • {n.unread ? "unread" : "read"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/admin/notifications/${n.id}`}
                    className="text-xs text-purple-600 hover:underline"
                  >
                    Edit
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <Link
          href="/admin"
          className="inline-block mt-4 text-[11px] text-gray-400 hover:text-gray-600"
        >
          ← back to admin
        </Link>
      </section>
    </main>
  );
}