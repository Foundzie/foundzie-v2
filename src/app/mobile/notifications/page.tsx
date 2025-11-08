// src/app/mobile/notifications/page.tsx
import Link from "next/link";
import { mockNotifications } from "@/app/data/notifications";

export default function MobileNotificationsPage() {
  return (
    <main className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Alerts</h1>
        <Link href="/mobile" className="text-sm text-purple-700">
          back
        </Link>
      </div>

      <p className="text-sm text-gray-500">
        These come from <code>src/app/data/notifications.ts</code>
      </p>

      <ul className="space-y-3">
        {mockNotifications.map((n) => (
          <li
            key={n.id}
            className="rounded-lg border border-gray-200 p-3 bg-white"
          >
            <div className="flex items-center gap-2 mb-1">
              <p className="font-medium">{n.title}</p>
              <span className="text-xs uppercase tracking-wide text-purple-700">
                {n.type}
              </span>
            </div>
            <p className="text-sm text-gray-600">{n.message}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}