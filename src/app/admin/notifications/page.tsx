// src/app/admin/notifications/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type NotificationType = "system" | "event" | "offer" | "chat";

interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  time: string;
  unread?: boolean;
  actionLabel?: string;
  actionHref?: string;
  mediaUrl?: string;
  mediaKind?: "image" | "gif" | "other";
}

export default function AdminNotificationsPage() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        const data = await res.json();
        setItems(data);
      } catch (err) {
        console.error("Failed to load notifications", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="w-full bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Notifications</h1>
          <p className="text-xs text-gray-500">
            Shared list coming from /api/notifications
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/admin/notifications/send"
            className="bg-purple-500 text-white text-sm px-4 py-2 rounded-md hover:bg-purple-600"
          >
            Send alert (mock)
          </Link>
          <Link
            href="/admin/notifications/new"
            className="bg-purple-600 text-white text-sm px-4 py-2 rounded-md hover:bg-purple-700"
          >
            + New
          </Link>
        </div>
      </header>

      <section className="px-6 py-6">
        <div className="bg-white border border-gray-200 rounded-lg">
          <ul className="divide-y divide-gray-100">
            {loading ? (
              <li className="p-6 text-sm text-gray-400">Loading…</li>
            ) : items.length === 0 ? (
              <li className="p-6 text-sm text-gray-400">
                No notifications yet.
              </li>
            ) : (
              items.map((n) => (
                <li
                  key={n.id}
                  className={`flex items-center justify-between px-4 py-3 ${
                    n.unread ? "bg-purple-50" : ""
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      {n.title}
                      <span className="text-[10px] uppercase tracking-wide bg-gray-100 text-gray-600 px-2 py-[2px] rounded">
                        {n.type}
                      </span>
                      {n.unread && (
                        <span className="text-[10px] text-purple-600 font-semibold">
                          • unread
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">{n.message}</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {n.time}
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
              ))
            )}
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
