// src/app/mobile/notifications/page.tsx
"use client";

import { useEffect, useState } from "react";

type NotificationType = "system" | "event" | "offer" | "chat";

interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  unread: boolean;
  time: string;
  actionLabel?: string;
  actionHref?: string;
}

const FILTERS: Array<{ id: "all" | NotificationType; label: string }> = [
  { id: "all", label: "All" },
  { id: "system", label: "System" },
  { id: "offer", label: "Offers" },
  { id: "event", label: "Events" },
  { id: "chat", label: "Chat" },
];

export default function MobileNotificationsPage() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"all" | NotificationType>("all");

  // load notifications
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

  // initial load + auto refresh every 5 seconds
  useEffect(() => {
    load();
    const timer = setInterval(load, 5000); // refresh every 5 seconds
    return () => clearInterval(timer);
  }, []);

  // apply filter
  const shown =
    activeFilter === "all"
      ? items
      : items.filter((n) => n.type === activeFilter);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="px-4 pt-6 pb-2 space-y-2">
        <h1 className="text-xl font-semibold">Alerts</h1>
        <p className="text-xs text-slate-400">
          Latest updates from places near you
        </p>
      </div>

      {/* filter bar */}
      <div className="px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            className={
              f.id === activeFilter
                ? "text-xs px-3 py-1 rounded-full bg-slate-200/90 text-slate-900"
                : "text-xs px-3 py-1 rounded-full bg-slate-900 text-slate-200 border border-slate-800"
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      <ul className="divide-y divide-slate-900">
        {loading ? (
          <li className="px-4 py-6 text-center text-slate-400">Loading…</li>
        ) : shown.length === 0 ? (
          <li className="px-4 py-6 text-center text-slate-400">
            No alerts right now.
          </li>
        ) : (
          shown.map((n) => (
            <li
              key={n.id}
              className={`px-4 py-4 flex items-start gap-3 ${
                n.unread ? "bg-slate-900/30" : ""
              }`}
            >
              <div className="flex-1">
                <p className="text-sm font-medium">{n.title}</p>
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