// src/app/mobile/notifications/page.tsx
"use client";

import { useEffect, useState } from "react";

type NotificationType = "system" | "event" | "offer" | "chat";

interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  unread?: boolean;
  time: string;
  actionLabel?: string;
  actionHref?: string;
  mediaUrl?: string;
  mediaKind?: "image" | "gif" | "other";
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
  const [activeFilter, setActiveFilter] =
    useState<"all" | NotificationType>("all");
  const [selected, setSelected] = useState<AppNotification | null>(null);

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
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  // apply filter
  const shown =
    activeFilter === "all"
      ? items
      : items.filter((n) => n.type === activeFilter);

  const unreadCount = items.filter((n) => n.unread).length;

  async function markAsRead(id: string) {
    // optimistic update
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
    );

    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, unread: false }),
      });
    } catch (err) {
      console.error("Failed to mark notification read", err);
      // not critical; we keep the optimistic UI
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
    <main className="min-h-screen bg-slate-950 text-white relative">
      <div className="px-4 pt-6 pb-2 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Alerts</h1>
            <p className="text-xs text-slate-400">
              Latest updates from places near you
            </p>
          </div>
          {unreadCount > 0 && (
            <div className="px-2 py-1 rounded-full bg-pink-600 text-[11px] font-medium">
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
              onClick={() => openDetails(n)}
              className={`px-4 py-4 flex items-start gap-3 cursor-pointer ${
                n.unread ? "bg-slate-900/30" : ""
              }`}
            >
              <div className="flex-1">
                <p className="text-sm font-medium flex items-center gap-2">
                  {n.title}
                  {n.unread && (
                    <span className="w-2 h-2 rounded-full bg-pink-500 inline-block" />
                  )}
                </p>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  {n.message}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">{n.time}</p>
              </div>
              <span className="text-[10px] uppercase text-slate-400">
                {n.type}
              </span>
            </li>
          ))
        )}
      </ul>

      {/* DETAIL DIALOG */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-30"
          onClick={closeDetails}
        >
          <div
            className="bg-slate-900 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">{selected.title}</h2>
              <button
                type="button"
                onClick={closeDetails}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Close
              </button>
            </div>

            <p className="text-[11px] text-slate-500">
              {selected.time} · {selected.type}
            </p>

            {/* media preview */}
            {selected.mediaUrl && (
              <div className="mt-1">
                {/* for now we just render an img; gif also works */}
                <img
                  src={selected.mediaUrl}
                  alt={selected.title}
                  className="w-full rounded-xl border border-slate-800 max-h-60 object-cover"
                />
              </div>
            )}

            <p className="text-sm text-slate-100 whitespace-pre-wrap">
              {selected.message}
            </p>

            {selected.actionHref && selected.actionLabel && (
              <a
                href={selected.actionHref}
                className="inline-flex items-center justify-center mt-2 px-4 py-2 rounded-full bg-pink-600 text-xs font-medium text-white hover:bg-pink-500"
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
