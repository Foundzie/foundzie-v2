// src/app/admin/users/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type AdminUserStatus = "active" | "invited" | "disabled" | "collected";
type AdminUserRole = "admin" | "editor" | "viewer";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  joined: string;
  interest?: string;
  source?: string;
};

const ROLES: AdminUserRole[] = ["admin", "editor", "viewer"];
const STATUSES: AdminUserStatus[] = [
  "active",
  "invited",
  "disabled",
  "collected",
];

export default function AdminEditUserPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  // load user from API
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/users/${id}`, { cache: "no-store" });
        const data = await res.json();
        if (data.ok) {
          setUser(data.item);
        } else {
          setError(data.message ?? "Failed to load user");
        }
      } catch (err) {
        setError("Failed to load user");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
      });
      const data = await res.json();
      if (data.ok) {
        setUser(data.item);
        setSavedMsg("Saved!");
      } else {
        setError(data.message ?? "Save failed");
      }
    } catch (err) {
      setError("Save failed");
    } finally {
      setSaving(false);
    }
  }

  function updateField<K extends keyof AdminUser>(key: K, value: AdminUser[K]) {
    setUser((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  if (loading) {
    return (
      <main className="p-8 space-y-4">
        <Link href="/admin/users" className="text-sm text-purple-700">
          &larr; back to users
        </Link>
        <p>Loading user…</p>
      </main>
    );
  }

  if (error || !user) {
    return (
      <main className="p-8 space-y-4">
        <Link href="/admin/users" className="text-sm text-purple-700">
          &larr; back to users
        </Link>
        <h1 className="text-xl font-semibold">User not found</h1>
        <p className="text-gray-500">{error ?? `No user with id ${id}`}</p>
      </main>
    );
  }

  return (
    <main className="p-8 space-y-6 max-w-lg">
      <Link href="/admin/users" className="text-sm text-purple-700">
        &larr; back to users
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">Edit user</h1>
        <p className="text-xs text-gray-500">
          Values shown here come from the live in-memory API.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        {/* name */}
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            value={user.name}
            onChange={(e) => updateField("name", e.target.value)}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
          />
        </div>

        {/* email */}
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            value={user.email}
            onChange={(e) => updateField("email", e.target.value)}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
          />
        </div>

        {/* role + status */}
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Role</label>
            <select
              value={user.role}
              onChange={(e) => updateField("role", e.target.value as AdminUserRole)}
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm bg-white"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={user.status}
              onChange={(e) =>
                updateField("status", e.target.value as AdminUserStatus)
              }
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm bg-white"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* interest */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Interest (from mobile)
          </label>
          <input
            value={user.interest ?? ""}
            onChange={(e) => updateField("interest", e.target.value)}
            placeholder="e.g. brunch"
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
          />
        </div>

        {/* source */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Source (where this came from)
          </label>
          <input
            value={user.source ?? ""}
            onChange={(e) => updateField("source", e.target.value)}
            placeholder="mobile-home / popup / campaign-1"
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
          />
        </div>

        {/* joined (read-only) */}
        <p className="text-xs text-gray-400">
          Joined: {user.joined ?? "—"}
        </p>

        {/* messages */}
        {error ? (
          <p className="text-xs text-red-500">{error}</p>
        ) : null}
        {savedMsg ? (
          <p className="text-xs text-green-500">{savedMsg}</p>
        ) : null}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </main>
  );
}