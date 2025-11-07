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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // right now just log it — later we’ll send to an API / DB
    console.log("new notification", {
      title,
      message,
      type,
      actionLabel,
      actionHref,
    });

    alert("Mock: notification would be saved now 👍");
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
            This is a mocked form. Later we will wire it to the backend so it
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
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              placeholder="15% off at GMEA"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Message
            </label>
            <textarea
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              rows={3}
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

          <div className="grid grid-cols-2 gap-3">
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
            className="bg-purple-600 text-white text-sm px-4 py-2 rounded-md hover:bg-purple-700 transition"
          >
            Save (mock)
          </button>
        </form>
      </section>
    </main>
  );
}