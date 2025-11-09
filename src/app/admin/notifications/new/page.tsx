// src/app/admin/notifications/new/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";

export default function AdminNewNotificationPage() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"system" | "offer" | "event" | "chat">(
    "system"
  );
  const [actionLabel, setActionLabel] = useState("");
  const [actionHref, setActionHref] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    const res = await fetch("/api/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        message,
        type,
        actionLabel,
        actionHref,
      }),
    });

    if (res.ok) {
      setSaved(true);
      // optional: clear form
      setTitle("");
      setMessage("");
      setType("system");
      setActionLabel("");
      setActionHref("");
    } else {
      alert("Could not save notification (mock API).");
    }

    setSaving(false);
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="w-full bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            New notification
          </h1>
          <p className="text-xs text-gray-500">
            This is a mocked form. Now it saves to /api/notifications so it
            shows in the mobile app.
          </p>
        </div>
        <Link
          href="/admin/notifications"
          className="text-[10px] text-gray-400 hover:text-gray-600"
        >
          ← back to notifications
        </Link>
      </header>

      {/* Form */}
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
              placeholder="15% off at GMEA"
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
              placeholder="You're close to GMEA in Downers Grove. Want to book?"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={type}
              onChange={(e) =>
                setType(e.target.value as "system" | "offer" | "event" | "chat")
              }
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="system">system</option>
              <option value="offer">offer</option>
              <option value="event">event</option>
              <option value="chat">chat</option>
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Action label (optional)
              </label>
              <input
                value={actionLabel}
                onChange={(e) => setActionLabel(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                placeholder="View"
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
                placeholder="/mobile/explore"
              />
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
              ✅ Notification saved. Check admin/mobile lists.
            </p>
          )}
        </form>
      </section>
    </main>
  );
}