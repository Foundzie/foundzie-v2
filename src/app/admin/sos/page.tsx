// src/app/admin/sos/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SosStatus = "new" | "in-progress" | "resolved";

interface SosAction {
  id: string;
  at: string;
  text: string;
  by?: string | null;
}

interface SosEvent {
  id: string;
  type: string;
  message: string;
  status: SosStatus;
  createdAt: string;
  location?: string | null;
  source?: string | null;
  phone?: string | null;
  actions?: SosAction[];
}

const statusLabels: Record<SosStatus, string> = {
  new: "New",
  "in-progress": "In progress",
  resolved: "Resolved",
};

const statusColors: Record<SosStatus, string> = {
  new: "bg-red-100 text-red-700",
  "in-progress": "bg-amber-100 text-amber-700",
  resolved: "bg-emerald-100 text-emerald-700",
};

export default function AdminSosPage() {
  const [items, setItems] = useState<SosEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | SosStatus>("all");

  async function loadEvents() {
    try {
      const res = await fetch("/api/sos", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to load SOS events");

      const list = Array.isArray(data.items) ? (data.items as SosEvent[]) : [];
      setItems(list);
      setError(null);
    } catch (err: any) {
      console.error("SOS load error", err);
      setError(err?.message || "Could not load SOS events.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
    const id = setInterval(loadEvents, 5000); // simple polling for now
    return () => clearInterval(id);
  }, []);

  async function changeStatus(item: SosEvent, status: SosStatus) {
    // Ask admin for an optional note
    const note = window.prompt(
      "Add a brief note about what you did (optional):",
      ""
    );

    // Optimistic update
    setItems((prev) =>
      prev.map((e) => {
        if (e.id !== item.id) return e;

        const actions = e.actions ? [...e.actions] : [];
        if (note && note.trim()) {
          actions.push({
            id: "temp-" + Date.now().toString(),
            at: new Date().toISOString(),
            text: note.trim(),
            by: "Admin",
          });
        }

        return {
          ...e,
          status,
          actions,
        };
      })
    );

    try {
      const res = await fetch("/api/sos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          status,
          note: note || "",
          by: "Admin",
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Failed to update status");
      }
    } catch (err) {
      console.error("Status update error", err);
      // reload from server to undo bad optimistic change if needed
      loadEvents();
    }
  }

  const visible =
    filter === "all"
      ? items
      : items.filter((e) => e.status === filter);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">SOS / Emergency</h1>
            <p className="text-sm text-slate-500">
              Live SOS alerts coming from the mobile app. Update status as you
              handle each case.
            </p>
          </div>

          <Link
            href="/admin/dashboard"
            className="text-sm text-pink-600 underline"
          >
            ← Back to dashboard
          </Link>
        </header>

        {/* filters */}
        <div className="flex gap-2 text-xs">
          {(["all", "new", "in-progress", "resolved"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={[
                "px-3 py-1 rounded-full border",
                filter === f
                  ? "bg-pink-600 text-white border-pink-600"
                  : "bg-white text-slate-600 border-slate-200",
              ].join(" ")}
            >
              {f === "all" ? "All" : statusLabels[f]}
            </button>
          ))}
        </div>

        <section className="bg-white rounded-xl shadow-sm border border-slate-200 divide-y divide-slate-100">
          {loading && (
            <p className="p-4 text-sm text-slate-500">Loading SOS events…</p>
          )}

          {!loading && visible.length === 0 && !error && (
            <p className="p-4 text-sm text-slate-500">
              No SOS events yet. When a user sends an SOS from the app, it will
              appear here instantly.
            </p>
          )}

          {error && (
            <p className="p-4 text-sm text-red-500 font-medium">{error}</p>
          )}

          {visible.map((item) => {
            const actions = item.actions ?? [];
            const lastAction =
              actions.length > 0 ? actions[actions.length - 1] : null;

            return (
              <div
                key={item.id}
                className="p-4 flex items-start justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">
                      {item.type.toUpperCase()}
                    </span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full ${statusColors[item.status]}`}
                    >
                      {statusLabels[item.status]}
                    </span>
                  </div>

                  <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">
                    {item.message}
                  </p>

                  <p className="text-[11px] text-slate-400">
                    {new Date(item.createdAt).toLocaleString()}
                    {item.source ? ` • Source: ${item.source}` : null}
                  </p>

                  {item.location && (
                    <p className="text-[11px] text-slate-500">
                      Location: {item.location}
                    </p>
                  )}

                  {item.phone && (
                    <p className="text-[11px] text-slate-500">
                      Caller phone:{" "}
                      <a
                        href={`tel:${item.phone}`}
                        className="text-pink-600 underline"
                      >
                        {item.phone}
                      </a>
                    </p>
                  )}

                  {lastAction && (
                    <p className="text-[11px] text-slate-500">
                      <span className="font-semibold">Last note:</span>{" "}
                      {lastAction.text}
                      {lastAction.by ? ` — ${lastAction.by}` : ""}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => changeStatus(item, "in-progress")}
                    className="px-3 py-1 rounded-full border border-amber-500 text-amber-700 hover:bg-amber-50"
                  >
                    Mark in progress
                  </button>
                  <button
                    type="button"
                    onClick={() => changeStatus(item, "resolved")}
                    className="px-3 py-1 rounded-full border border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                  >
                    Resolve
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
