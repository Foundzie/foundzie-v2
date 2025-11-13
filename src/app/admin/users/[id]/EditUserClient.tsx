// src/app/admin/users/[id]/EditUserClient.tsx
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
  tags?: string[]; // NEW
};

const ROLES: AdminUserRole[] = ["admin", "editor", "viewer"];
const STATUSES: AdminUserStatus[] = ["active", "invited", "disabled", "collected"];

export default function EditUserClient({ id }: { id: string }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  // helper: update any field
  function updateField<K extends keyof AdminUser>(key: K, value: AdminUser[K]) {
    setUser((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        setSavedMsg(null);

        const cleanId = String(id ?? "").trim();
        if (!cleanId) {
          setError("Missing id in route");
          setLoading(false);
          return;
        }

        const url = `/api/users/${encodeURIComponent(cleanId)}`;
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json().catch(() => ({} as any));

        if (res.ok && data.ok && data.item) {
          setUser(data.item as AdminUser);
        } else {
          setError(data?.message ?? "Failed to load user");
        }
      } catch {
        setError("Failed to load user");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  async function handleSave() {
    try {
      const cleanId = String(id ?? "").trim();
      if (!cleanId || !user) return;

      setSaving(true);
      setError(null);
      setSavedMsg(null);

      const url = `/api/users/${encodeURIComponent(cleanId)}`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
      });

      const data = await res.json().catch(() => ({} as any));

      if (res.ok && data.ok && data.item) {
        setUser(data.item as AdminUser);
        setSavedMsg("Saved!");
      } else {
        setError(data?.message ?? "Save failed");
      }
    } catch {
      setError("Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      const cleanId = String(id ?? "").trim();
      if (!cleanId) return;

      setSaving(true);
      setError(null);

      const url = `/api/users/${encodeURIComponent(cleanId)}`;
      const res = await fetch(url, { method: "DELETE" });

      if (!res.ok) {
        const data = await res.json().catch(() => ({} as any));
        setError(data?.message ?? "Delete failed");
        setSaving(false);
        return;
      }

      // back to users list
      window.location.href = "/admin/users";
    } catch {
      setError("Delete failed");
      setSaving(false);
    }
  }

  // ── render ────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="p-8 space-y-4">
        <Link href="/admin/users" className="text-sm text-purple-700">
          &larr; back to users
        </Link>
        <p>Loading user...</p>
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
        <p className="text-gray-500">
          {error ?? `No user with id ${id}`}
        </p>
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

      {error && (
        <p className="text-sm text-red-600">
          {error}
        </p>
      )}

      {savedMsg && (
        <p className="text-sm text-green-600">
          {savedMsg}
        </p>
      )}

      <div className="space-y-4 bg-white rounded-xl border border-gray-200 p-5">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
            value={user.name}
            onChange={(e) => updateField("name", e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
            value={user.email}
            onChange={(e) => updateField("email", e.target.value)}
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Role</label>
            <select
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm bg-white"
              value={user.role}
              onChange={(e) =>
                updateField("role", e.target.value as AdminUserRole)
              }
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
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm bg-white"
              value={user.status}
              onChange={(e) =>
                updateField("status", e.target.value as AdminUserStatus)
              }
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

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

        {/* NEW TAGS FIELD */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Tags (comma separated)
          </label>
          <input
            value={user.tags && user.tags.length > 0 ? user.tags.join(", ") : ""}
            onChange={(e) =>
              updateField(
                "tags",
                e.target.value
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean) as string[]
              )
            }
            placeholder="e.g. vip, chicago, nightlife"
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
          />
        </div>

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

        <p className="text-xs text-gray-400">
          Joined: {user.joined ?? "-"}
        </p>

        <div className="flex items-center justify-between gap-4 pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center justify-center rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={saving}
            className="text-xs text-red-600 border border-red-300 rounded-md px-3 py-1 disabled:opacity-60"
          >
            Delete user
          </button>
        </div>
      </div>
    </main>
  );
}
