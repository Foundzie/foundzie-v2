// src/app/mobile/notifications/page.tsx
"use client";

import { useEffect, useState } from "react";

type NotificationType = "system" | "event" | "offer" | "chat";

interface AppNotification {
  id: string;
  type: NotificationType | string;
  title: string;
  message: string;
  unread?: boolean;
  time: string;
  actionLabel?: string;
  actionHref?: string;
  mediaUrl?: string;
  mediaKind?: "image" | "gif" | "other" | null;
}

const FILTERS: Array<{ id: "all" | NotificationType; label: string }> = [
  { id: "all", label: "All" },
  { id: "system", label: "System" },
  { id: "offer", label: "Offers" },
  { id: "event", label: "Events" },
  { id: "chat", label: "Chat" },
];

function isSpotlight(n: AppNotification) {
  return n.type === "offer" && !!n.mediaUrl;
}

export default function MobileNotificationsPage() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] =
    useState<"all" | NotificationType>("all");
  const [selected, setSelected] = useState<AppNotification | null>(null);

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

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  const shown =
    activeFilter === "all"
      ? items
      : items.filter((n) => n.type === activeFilter);

  const unreadCount = items.filter((n) => n.unread).length;

  async function markAsRead(id: string) {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
    );

    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, unread: false }),
      });
    } catch (err) {
      console.error("Failed to mark notification read", err);
    }
  }

  function openDetails(notification: AppNotification) {
    setSelected(notification);
    if (notification.unread) {
      markAsRead(notification.id);
    }
  }

  function closeDetails() {
    setSelected(null);
  }

  return (
    <main className="min-h-screen bg-white text-slate-900 relative">
      <div className="px-4 pt-6 pb-2 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Alerts</h1>
            <p className="text-xs text-slate-600">
              Latest updates and Spotlight offers near you
            </p>
          </div>
          {unreadCount > 0 && (
            <div className="px-2 py-1 rounded-full bg-pink-500 text-white text-[11px] font-medium">
              {unreadCount} new
            </div>
          )}
        </div>
      </div>

      {/* filter bar */}
      <div className="px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            className={
              f.id === activeFilter
                ? "text-xs px-3 py-1 rounded-full bg-slate-900 text-white"
                : "text-xs px-3 py-1 rounded-full bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100"
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      <ul className="divide-y divide-slate-100">
        {loading ? (
          <li className="px-4 py-6 text-center text-slate-500">Loading…</li>
        ) : shown.length === 0 ? (
          <li className="px-4 py-6 text-center text-slate-500">
            No alerts right now.
          </li>
        ) : (
          shown.map((n) => {
            const spotlight = isSpotlight(n);
            return (
              <li
                key={n.id}
                onClick={() => openDetails(n)}
                className={`px-4 py-4 flex items-start gap-3 cursor-pointer ${
                  n.unread ? "bg-slate-50" : "bg-white"
                } hover:bg-slate-50`}
              >
                <div className="flex-1">
                  <p className="text-sm font-medium flex items-center gap-2">
                    {n.title}
                    {spotlight && (
                      <span className="text-[9px] uppercase bg-yellow-300 text-slate-900 px-2 py-[1px] rounded-full">
                        Spotlight
                      </span>
                    )}
                    {n.unread && (
                      <span className="w-2 h-2 rounded-full bg-pink-500 inline-block" />
                    )}
                  </p>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                    {n.message}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">{n.time}</p>
                </div>
                <span className="text-[10px] uppercase text-slate-500">
                  {n.type}
                </span>
              </li>
            );
          })
        )}
      </ul>

      {/* DETAIL DIALOG */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-30"
          onClick={closeDetails}
        >
          <div
            className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-4 space-y-3 border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold flex items-center gap-2 text-slate-900">
                {selected.title}
                {isSpotlight(selected) && (
                  <span className="text-[9px] uppercase bg-yellow-300 text-slate-900 px-2 py-[1px] rounded-full">
                    Spotlight
                  </span>
                )}
              </h2>
              <button
                type="button"
                onClick={closeDetails}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Close
              </button>
            </div>

            <p className="text-[11px] text-slate-500">
              {selected.time} · {selected.type}
            </p>

            {selected.mediaUrl && (
              <div className="mt-1">
                <img
                  src={selected.mediaUrl}
                  alt={selected.title}
                  className="w-full rounded-xl border border-slate-200 max-h-60 object-cover"
                />
              </div>
            )}

            <p className="text-sm text-slate-900 whitespace-pre-wrap">
              {selected.message}
            </p>

            {selected.actionHref && selected.actionLabel && (
              <a
                href={selected.actionHref}
                className="inline-flex items-center justify-center mt-2 px-4 py-2 rounded-full bg-pink-500 text-xs font-medium text-white hover:bg-pink-400"
              >
                {selected.actionLabel}
              </a>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
