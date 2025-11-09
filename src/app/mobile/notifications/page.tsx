// src/app/mobile/notifications/page.tsx
"use client";

import { useEffect, useState } from "react";

type NotificationType = "system" | "event" | "offer" | "chat";

interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  time: string;
  unread: boolean;
  actionLabel?: string;
  actionHref?: string;
}

export default function MobileNotificationsPage() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        const data = await res.json();
        setItems(data);
      } catch (err) {
        console.error("failed to load mobile notifications", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="px-4 pt-6 pb-4 space-y-2">
        <h1 className="text-xl font-semibold">Alerts</h1>
        <p className="text-xs text-slate-400">Latest updates from places near you</p>
      </div>

      <ul className="divide-y divide-slate-900">
        {loading ? (
          <li className="px-4 py-6 text-sm text-slate-400">Loading…</li>
        ) : items.length === 0 ? (
          <li className="px-4 py-6 text-sm text-slate-400">No alerts right now.</li>
        ) : (
          items.map((n) => (
            <li key={n.id} className="px-4 py-4 flex items-start gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{n.title}</p>
                <p className="text-xs text-slate-400 mt-1">{n.message}</p>
                <p className="text-[10px] text-slate-500 mt-1">{n.time}</p>
              </div>
              <span className="text-[10px] uppercase text-slate-400">
                {n.type}
              </span>
            </li>
          ))
        )}
      </ul>
    </main>
  );
}