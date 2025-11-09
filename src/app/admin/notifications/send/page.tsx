"use client";

import Link from "next/link";
import { useState } from "react";

export default function AdminSendNotificationMock() {
  const [title, setTitle] = useState("Today near you");
  const [message, setMessage] = useState(
    "GMEA has 15% off lunch right now, want to book?"
  );
  const [audience, setAudience] = useState("nearby");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSent(false);
    setLoading(true);

    try {
      // send to the shared endpoint we just created
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          message,
          // pick a type based on audience, just like before
          type: audience === "segment" ? "offer" : "system",
          time: "just now",
          unread: true,
        }),
      });

      if (!res.ok) {
        console.error("Failed to add notification", await res.text());
        return;
      }

      setSent(true);
    } catch (err) {
      console.error("Error sending notification", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Send alert (mock)
          </h1>
          <p className="text-gray-500 text-sm">
            This sends a mock alert to <code>/api/notifications</code>. Later
            we’ll plug in real geo targeting.
          </p>
        </div>
        <Link href="/admin/notifications" className="text-sm text-gray-500">
          ← Back to notifications
        </Link>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white border rounded-lg p-5 space-y-4 shadow-sm"
      >
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="w-full border rounded-md px-3 py-2 text-sm"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Audience</label>
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm"
          >
            <option value="all">All users</option>
            <option value="nearby">Nearby (mock)</option>
            <option value="segment">Segment / VIP (mock)</option>
          </select>
          <p className="text-xs text-gray-400 mt-1">
            Later we’ll use real location logic here.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-purple-600 text-white px-4 py-2 rounded-md text-sm hover:bg-purple-700 disabled:opacity-50"
        >
          {loading ? "Sending..." : "Send alert"}
        </button>

        {sent && (
          <p className="text-sm text-green-600 mt-2">
            ✅ Mock alert added. Go to Notifications to see it in the list.
          </p>
        )}
      </form>
    </main>
  );
}