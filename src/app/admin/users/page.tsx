// src/app/admin/users/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  joined: string;
  interest?: string;
  source?: string; // NEW-ish: already in your file
  tags?: string[]; // NEW: tags from admin or mobile
};

type FilterValue = "all" | "collected" | "concierge";

function extractPhone(text?: string | null): string | null {
  if (!text) return null;

  // Look for patterns like: "Phone: 557 656565" (case insensitive)
  const match = text.match(/phone[:\s]+([\d+\-\s()]+)/i);
  if (!match) return null;

  const phone = match[1].trim();
  return phone.length ? phone : null;
}

export default function AdminUsersPage() {
  const [items, setItems] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterValue>("all");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/users", { cache: "no-store" });
        const data = await res.json();
        setItems((data.items ?? []) as AdminUser[]);
      } catch (err) {
        console.error("Failed to load users", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  // Same meaning as your old "collected" logic:
  // status = collected OR has source/interest from mobile
  const collectedItems = items.filter(
    (u) =>
      u.status === "collected" ||
      typeof u.source === "string" ||
      typeof u.interest === "string",
  );

  // Narrow concierge queue
  const conciergeItems = items.filter((u) => {
    if (u.status !== "collected") return false;

    const hasConciergeTag =
      Array.isArray(u.tags) && u.tags.includes("concierge-request");
    const fromConciergeSource = u.source === "mobile-concierge";

    return hasConciergeTag || fromConciergeSource;
  });

  // Decide what to show based on filter
  const shown =
    filter === "all"
      ? items
      : filter === "collected"
      ? collectedItems
      : conciergeItems;

  return (
    <main className="min-h-screen bg-white px-6 py-6 max-w-lg">
      <Link
        href="/admin"
        className="text-xs text-gray-400 mb-4 inline-block"
      >
        &larr; back to admin
      </Link>

      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Users</h1>
          <p className="text-sm text-gray-500">
            Live list coming from <code>/api/users</code>
          </p>
        </div>

        <Link
          href="/admin/users/new"
          className="bg-purple-600 text-white text-sm px-4 py-2 rounded-md"
        >
          + New (mock)
        </Link>
      </header>

      {/* filter bar */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilter("all")}
          className={`text-xs px-3 py-1 rounded-full ${
            filter === "all"
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          All ({items.length})
        </button>

        <button
          onClick={() => setFilter("collected")}
          className={`text-xs px-3 py-1 rounded-full ${
            filter === "collected"
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          Collected ({collectedItems.length})
        </button>

        <button
          onClick={() => setFilter("concierge")}
          className={`text-xs px-3 py-1 rounded-full ${
            filter === "concierge"
              ? "bg-purple-600 text-white"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          Concierge ({conciergeItems.length})
        </button>
      </div>

      <div className="bg-gray-50 border border-gray-100 rounded-xl divide-y divide-gray-100 max-w-lg">
        {loading && (
          <p className="px-4 py-6 text-sm text-gray-400">Loading users...</p>
        )}

        {!loading && shown.length === 0 && (
          <p className="px-4 py-6 text-sm text-gray-400">No users yet.</p>
        )}

        {shown.map((u) => {
          const phoneHint = extractPhone(u.interest);
          const isConciergeRow = conciergeItems.some((c) => c.id === u.id);

          return (
            <div
              key={u.id}
              className={`flex items-start justify-between px-4 py-4 gap-4 ${
                isConciergeRow ? "bg-purple-50" : ""
              }`}
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{u.name}</p>
                <p className="text-xs text-gray-500">{u.email}</p>
                <p className="text-[11px] text-gray-400 mt-1">
                  Joined: {u.joined}
                </p>

                {u.interest && (
                  <p className="text-[11px] text-pink-500 mt-1">
                    interest: {u.interest}
                  </p>
                )}

                {phoneHint && (
                  <p className="text-[11px] text-emerald-600 mt-0.5">
                    Phone (parsed): {phoneHint}
                  </p>
                )}

                {u.source && (
                  <p className="text-[11px] text-gray-300">
                    source: {u.source}
                  </p>
                )}

                {Array.isArray(u.tags) && u.tags.length > 0 && (
                  <p className="text-[11px] text-blue-500 mt-1">
                    tags: {u.tags.join(", ")}
                  </p>
                )}
              </div>

              <div className="flex gap-4 items-center">
                <span
                  className={
                    u.status === "active"
                      ? "text-xs text-green-500"
                      : u.status === "collected"
                      ? "text-xs text-amber-500"
                      : u.status === "invited"
                      ? "text-xs text-blue-500"
                      : "text-xs text-gray-400"
                  }
                >
                  {u.status.toUpperCase()}
                </span>

                <Link
                  href={`/admin/users/${String(u.id)}`}
                  className="text-xs text-purple-600 hover:underline"
                >
                  edit
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
