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
  source?: string;
};

export default function AdminUsersPage() {
  const [items, setItems] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "collected">("all");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/users", { cache: "no-store" });
        const data = await res.json();
        setItems(data.items ?? []);
      } catch (err) {
        console.error("Failed to load users", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // pick what to show based on filter
  const shown =
    filter === "all"
      ? items
      : items.filter(
          (u) =>
            u.status === "collected" ||
            typeof u.source === "string" ||
            typeof u.interest === "string"
        );

  return (
    <main className="min-h-screen bg-white px-6 py-6">
      <Link href="/admin" className="text-xs text-gray-400 mb-4 inline-block">
        &larr; back to admin
      </Link>

      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Users</h1>
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
          Collected (
          {
            items.filter(
              (u) =>
                u.status === "collected" ||
                typeof u.source === "string" ||
                typeof u.interest === "string"
            ).length
          }
          )
        </button>
      </div>

      <div className="bg-gray-50 border border-gray-100 rounded-xl divide-y divide-gray-100 max-w-lg">
        {loading && (
          <p className="px-4 py-6 text-sm text-gray-400">Loading users...</p>
        )}

        {!loading && shown.length === 0 && (
          <p className="px-4 py-6 text-sm text-gray-400">No users yet.</p>
        )}

        {shown.map((u) => (
          <div
            key={u.id}
            className="flex items-start justify-between px-4 py-4 gap-4"
          >
            <div>
              <p className="text-sm font-medium text-gray-900">{u.name}</p>
              <p className="text-xs text-gray-400">{u.email}</p>
              <p className="text-[11px] text-gray-400">Joined {u.joined}</p>

              {u.interest ? (
                <p className="text-[11px] text-pink-500 mt-1">
                  interest: {u.interest}
                </p>
              ) : null}

              {u.source ? (
                <p className="text-[11px] text-gray-300">source: {u.source}</p>
              ) : null}
            </div>

            <div className="flex gap-4 items-center">
              <span
                className={
                  u.status === "active"
                    ? "text-xs text-green-500"
                    : u.status === "collected"
                    ? "text-xs text-amber-500"
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
        ))}
      </div>
    </main>
  );
}
