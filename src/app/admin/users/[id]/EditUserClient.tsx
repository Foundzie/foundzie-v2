"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type AdminUserStatus = "active" | "invited" | "disabled" | "collected";
type AdminUserRole = "admin" | "editor" | "viewer";
type ConciergeStatus = "open" | "in-progress" | "done";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  joined: string;

  interest?: string;
  source?: string;
  tags: string[];

  conciergeStatus?: ConciergeStatus;
  conciergeNote?: string;

  roomId?: string;
  phone?: string | null;
};

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
  userId?: string | null;
  actions?: SosAction[];
}

const ROLES: AdminUserRole[] = ["admin", "editor", "viewer"];
const STATUSES: AdminUserStatus[] = ["active", "invited", "disabled", "collected"];
const CONCIERGE_STATUSES: ConciergeStatus[] = ["open", "in-progress", "done"];

export default function EditUserClient({ id }: { id: string }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  // SOS history for this user
  const [sosItems, setSosItems] = useState<SosEvent[]>([]);
  const [sosLoading, setSosLoading] = useState(true);
  const [sosError, setSosError] = useState<string | null>(null);

  // call button state
  const [calling, setCalling] = useState(false);
  const [callMsg, setCallMsg] = useState<string | null>(null);

  // helper: update any field
  function updateField<K extends keyof AdminUser>(key: K, value: AdminUser[K]) {
    setUser((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function loadSosForUser(userId: string) {
    try {
      setSosLoading(true);
      setSosError(null);

      const url = `/api/sos?userId=${encodeURIComponent(userId)}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json().catch(() => ({} as any));

      if (res.ok && Array.isArray(data.items)) {
        setSosItems(data.items as SosEvent[]);
      } else {
        setSosError(data?.message ?? "Failed to load SOS history");
      }
    } catch {
      setSosError("Failed to load SOS history");
    } finally {
      setSosLoading(false);
    }
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
          const item = data.item as AdminUser;
          // make sure tags is always an array
          if (!Array.isArray(item.tags)) {
            item.tags = [];
          }
          setUser(item);
          // Once user is loaded, fetch SOS events linked to this user
          await loadSosForUser(cleanId);
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
        const item = data.item as AdminUser;
        if (!Array.isArray(item.tags)) item.tags = [];
        setUser(item);
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
      const data = await res.json().catch(() => ({} as any));

      if (!res.ok || !data.ok) {
        setError(data?.message ?? "Delete failed");
        setSaving(false);
        return;
      }

      window.location.href = "/admin/users";
    } catch {
      setError("Delete failed");
      setSaving(false);
    }
  }

  async function handleCallUser() {
    if (!user?.phone || user.phone.trim() === "") {
      setCallMsg("Add a phone number first, then try calling.");
      return;
    }

    try {
      setCalling(true);
      setCallMsg(null);

      const note =
        window.prompt("Add a brief note for this call (optional):") ?? "";

      const res = await fetch("/api/calls/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: user.phone.trim(),
          userId: user.id,
          note: note.trim() || undefined,
        }),
      });

      const data = await res.json().catch(() => ({} as any));

      if (!res.ok || !data.ok) {
        setCallMsg(data?.message ?? "Call request failed");
        return;
      }

      const callId = data.callId ?? data.callID ?? data.id;
      setCallMsg(
        callId
          ? `Call request logged (id: ${String(callId)}).`
          : "Call request logged."
      );
    } catch {
      setCallMsg("Call request failed");
    } finally {
      setCalling(false);
    }
  }

  // ----- render -----

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
        <p className="text-sm text-gray-500">
          {error ?? `No user with id ${id}`}
        </p>
      </main>
    );
  }

  return (
    <main className="p-8 space-y-4 max-w-lg">
      <Link href="/admin/users" className="text-sm text-purple-700">
        &larr; back to users
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Edit user</h1>
        <p className="text-xs text-gray-500">
          Values shown here come from the live in-memory API.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {savedMsg && <p className="text-sm text-green-600">{savedMsg}</p>}
      {callMsg && <p className="text-xs text-blue-600">{callMsg}</p>}

      <div className="space-y-4 bg-white rounded-xl border border-gray-200 p-5">
        {/* basic info */}
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            type="text"
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

        <div>
          <label className="block text-sm font-medium mb-1">Phone</label>
          <input
            type="tel"
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
            value={user.phone ?? ""}
            onChange={(e) =>
              updateField(
                "phone",
                e.target.value.trim() === "" ? null : e.target.value
              )
            }
            placeholder="+1 (312) 555-0000"
          />
          <p className="text-[11px] text-gray-400 mt-1">
            Used when Foundzie concierge calls this user.{" "}
            <span className="font-medium">Users never call each other.</span>
          </p>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Role</label>
            <select
              value={user.role}
              onChange={(e) =>
                updateField("role", e.target.value as AdminUserRole)
              }
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

        {/* concierge workflow */}
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">
              Concierge status
            </label>
            <select
              value={user.conciergeStatus ?? ""}
              onChange={(e) =>
                updateField(
                  "conciergeStatus",
                  (e.target.value || undefined) as ConciergeStatus | undefined
                )
              }
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm bg-white"
            >
              <option value="">(none)</option>
              {CONCIERGE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Concierge note (internal)
          </label>
          <textarea
            rows={3}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
            value={user.conciergeNote ?? ""}
            onChange={(e) => updateField("conciergeNote", e.target.value)}
            placeholder="Internal notes about this concierge request..."
          />
        </div>

        {/* mobile fields */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Interest (from mobile)
          </label>
          <input
            type="text"
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
            value={user.interest ?? ""}
            onChange={(e) => updateField("interest", e.target.value)}
            placeholder="e.g. brunch, nightlife"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Tags (comma separated)
          </label>
          <input
            type="text"
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
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
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Source (where this came from)
          </label>
          <input
            type="text"
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
            value={user.source ?? ""}
            onChange={(e) => updateField("source", e.target.value)}
            placeholder="mobile-home / popup / campaign-1"
          />
        </div>

        <p className="text-xs text-gray-400">Joined: {user.joined ?? "-"}</p>

        {/* SOS history panel */}
        <div className="mt-6 border-t border-gray-100 pt-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">
            SOS history for this user
          </h2>

          {sosLoading && (
            <p className="text-xs text-gray-400">Loading SOS history…</p>
          )}

          {sosError && (
            <p className="text-xs text-red-500">{sosError}</p>
          )}

          {!sosLoading && !sosError && sosItems.length === 0 && (
            <p className="text-xs text-gray-400">
              No SOS events linked to this user yet.
            </p>
          )}

          <div className="space-y-3">
            {sosItems.map((ev) => {
              const actions = ev.actions ?? [];
              const lastAction =
                actions.length > 0 ? actions[actions.length - 1] : null;

              const badgeClass =
                ev.status === "new"
                  ? "bg-red-100 text-red-700"
                  : ev.status === "in-progress"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-700";

              const statusLabel =
                ev.status === "new"
                  ? "New"
                  : ev.status === "in-progress"
                  ? "In progress"
                  : "Resolved";

              return (
                <div
                  key={ev.id}
                  className="border border-gray-100 rounded-md px-3 py-2 bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-800">
                      {ev.type.toUpperCase()}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${badgeClass}`}
                    >
                      {statusLabel}
                    </span>
                  </div>

                  <p className="text-xs text-gray-800 whitespace-pre-wrap break-words">
                    {ev.message}
                  </p>

                  <p className="text-[10px] text-gray-400 mt-1">
                    {new Date(ev.createdAt).toLocaleString()}
                    {ev.source ? ` • Source: ${ev.source}` : ""}
                  </p>

                  {lastAction && (
                    <p className="text-[10px] text-gray-500 mt-1">
                      <span className="font-semibold">Last note:</span>{" "}
                      {lastAction.text}
                      {lastAction.by ? ` — ${lastAction.by}` : ""}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 pt-2">
          <div className="flex gap-2">
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
              onClick={handleCallUser}
              disabled={calling || !user.phone}
              className="inline-flex items-center justify-center rounded-md border border-purple-300 px-3 py-2 text-xs font-medium text-purple-700 disabled:opacity-50"
            >
              {calling
                ? "Calling..."
                : user.phone
                ? `Call ${user.phone}`
                : "Add phone to call"}
            </button>
          </div>

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
