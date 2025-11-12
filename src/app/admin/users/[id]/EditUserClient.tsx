// src/app/admin/users/[id]/EditUserClient.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

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

export default function EditUserClient() {
  const params = useParams<{ id: string }>();
  const raw = params?.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  const router = useRouter();

  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        setUser(null);

        if (!id) {
          setError("Missing id in route");
          setLoading(false);
          return;
        }

        const url = `/api/users/${encodeURIComponent(String(id).trim())}`;
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));

        if (res.ok && data?.ok && data?.item) {
          setUser(data.item);
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
    if (!user || !id) return;
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      const url = `/api/users/${encodeURIComponent(String(id).trim())}`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...user,
          // send tags as array; server accepts string or array
          tags: (user.tags ?? []).map((t) => t.trim()).filter(Boolean),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok && data?.item) {
        setUser(data.item);
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
    if (!id) return;
    if (!confirm("Delete this user? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(String(id))}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/admin/users");
        router.refresh?.();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data?.message ?? "Delete failed");
      }
    } catch {
      alert("Delete failed");
    }
  }

  function updateField<K extends keyof AdminUser>(key: K, value: AdminUser[K]) {
    setUser((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  // For the UI, edit tags as a simple comma string
  const tagsString = (user?.tags ?? []).join(", ");
  function setTagsFromString(str: string) {
    const tags = str.split(",").map((t) => t.trim()).filter(Boolean);
    updateField("tags", tags);
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
        <p className="text-xs text-gray-500">Values shown here come from the live in-memory API.</p>
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
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={user.status}
              onChange={(e) => updateField("status", e.target.value as AdminUserStatus)}
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm bg-white"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* interest */}
        <div>
          <label className="block text-sm font-medium mb-1">Interest (from mobile)</label>
          <input
            value={user.interest ?? ""}
            onChange={(e) => updateField("interest", e.target.value)}
            placeholder="e.g. brunch"
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
          />
        </div>

        {/* source */}
        <div>
          <label className="block text-sm font-medium mb-1">Source (where this came from)</label>
          <input
            value={user.source ?? ""}
            onChange={(e) => updateField("source", e.target.value)}
            placeholder="mobile-home / popup / campaign-1"
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
          />
        </div>

        {/* tags */}
        <div>
          <label className="block text-sm font-medium mb-1">Tags (comma separated)</label>
          <input
            value={tagsString}
            onChange={(e) => setTagsFromString(e.target.value)}
            placeholder="VIP, Local, Early-Access"
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
          />
        </div>

        <p className="text-xs text-gray-400">Joined: {user.joined ?? "—"}</p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : savedMsg ? savedMsg : "Save"}
          </button>

          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex items-center rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white"
          >
            Delete
          </button>
        </div>
      </div>
    </main>
  );
}
