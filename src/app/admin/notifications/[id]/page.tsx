// src/app/admin/notifications/[id]/page.tsx
import Link from "next/link";
import { mockNotifications } from "@/app/data/notifications";

export default function AdminEditNotificationPage({
  params,
}: {
  params: { id: string };
}) {
  const notification = mockNotifications.find((n) => n.id === params.id);

  if (!notification) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white border border-gray-200 rounded-lg px-6 py-8 text-center">
          <p className="text-sm text-gray-600 mb-4">
            Notification with id {params.id} not found (mock data).
          </p>
          <Link
            href="/admin/notifications"
            className="text-xs text-purple-600 hover:underline"
          >
            ← back to notifications
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="w-full bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Edit notification
          </h1>
          <p className="text-xs text-gray-500">
            Values shown here come from src/app/data/notifications.ts
          </p>
        </div>
        <Link
          href="/admin/notifications"
          className="text-[10px] text-gray-400 hover:text-gray-600"
        >
          ← back to notifications
        </Link>
      </header>

      <section className="px-6 py-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-xl">
          <div className="grid gap-4">
            <label className="text-xs text-gray-700">
              Title
              <input
                defaultValue={notification.title}
                className="mt-1 w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
              />
            </label>

            <label className="text-xs text-gray-700">
              Message
              <textarea
                defaultValue={notification.message}
                rows={3}
                className="mt-1 w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
              />
            </label>

            <label className="text-xs text-gray-700">
              Type
              <select
                defaultValue={notification.type}
                className="mt-1 w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
              >
                <option value="system">system</option>
                <option value="offer">offer</option>
                <option value="event">event</option>
                <option value="chat">chat</option>
              </select>
            </label>
          </div>

          <p className="text-[10px] text-gray-400 mt-4 mb-2">
            This is a mock edit screen. We’ll wire it to real storage later.
          </p>

          <button className="mt-2 bg-purple-600 text-white px-4 py-2 rounded-md text-sm hover:bg-purple-700">
            Save (mock)
          </button>
        </div>
      </section>
    </main>
  );
}