// src/app/admin/notifications/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type NotificationType = "system" | "offer" | "event" | "chat";

export default function AdminEditNotificationPage() {
  const params = useParams();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<NotificationType>("system");
  const [actionLabel, setActionLabel] = useState("");
  const [actionHref, setActionHref] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaKind, setMediaKind] =
    useState<"image" | "gif" | "other" | "">("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // load from API
  useEffect(() => {
    async function load() {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      const found = data.find((n: any) => n.id === id);
      if (!found) {
        setNotFound(true);
      } else {
        setTitle(found.title ?? "");
        setMessage(found.message ?? "");
        setType(found.type ?? "system");
        setActionLabel(found.actionLabel ?? "");
        setActionHref(found.actionHref ?? "");
        setMediaUrl(found.mediaUrl ?? "");
        setMediaKind(found.mediaKind ?? "");
      }
      setLoading(false);
    }
    if (id) {
      load();
    }
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    const res = await fetch("/api/notifications", {
      method: "POST", // route treats POST with id as update
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id,
        title,
        message,
        type,
        actionLabel,
        actionHref,
        mediaUrl: mediaUrl || undefined,
        mediaKind: mediaKind || undefined,
      }),
    });

    if (res.ok) {
      setSaved(true);
    } else {
      alert("Could not update notification.");
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 px-6 py-6">
        <p className="text-sm text-gray-500">Loading notification…</p>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="min-h-screen bg-gray-50 px-6 py-6">
        <p className="text-sm text-gray-500 mb-4">
          Notification with id {id} not found.
        </p>
        <Link
          href="/admin/notifications"
          className="text-xs text-purple-600 hover:underline"
        >
          ← back to notifications
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="w-full bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Edit notification
          </h1>
          <p className="text-xs text-gray-500">
            Values shown here come from /api/notifications.
          </p>
        </div>
        <Link
          href="/admin/notifications"
          className="text-[10px] text-gray-400 hover:text-gray-600"
        >
          ← back to notifications
        </Link>
      </header>

      <section className="px-6 py-6">
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-gray-200 rounded-lg p-5 max-w-xl space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              required
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={type}
              onChange={(e) =>
                setType(e.target.value as NotificationType)
              }
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="system">system</option>
              <option value="offer">offer</option>
              <option value="event">event</option>
              <option value="chat">chat</option>
            </select>
          </div>

          <div className="grid gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Action label (optional)
              </label>
              <input
                value={actionLabel}
                onChange={(e) => setActionLabel(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Action href (optional)
              </label>
              <input
                value={actionHref}
                onChange={(e) => setActionHref(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* NEW media fields */}
          <div className="grid gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Media URL (optional)
              </label>
              <input
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Media kind
              </label>
              <select
                value={mediaKind}
                onChange={(e) =>
                  setMediaKind(
                    e.target.value as "image" | "gif" | "other" | ""
                  )
                }
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="">None</option>
                <option value="image">Image</option>
                <option value="gif">GIF</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="bg-purple-600 text-white text-sm px-4 py-2 rounded-md hover:bg-purple-700 transition disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>

          {saved && (
            <p className="text-xs text-green-600">
              ✅ Notification updated. Check the list.
            </p>
          )}
        </form>
      </section>
    </main>
  );
}
