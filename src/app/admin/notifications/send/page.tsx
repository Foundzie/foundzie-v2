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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // mock send — later this will trigger a real push
    setSent(true);
  }

  return (
    <main className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Send alert (mock)</h1>
          <p className="text-gray-500 text-sm">
            This just simulates a send; later we’ll connect it to the real geo-push system.
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
          className="bg-purple-600 text-white px-4 py-2 rounded-md text-sm hover:bg-purple-700"
        >
          Send alert
        </button>

        {sent && (
          <p className="text-sm text-green-600 mt-2">
            ✅ Mock alert sent successfully.
          </p>
        )}
      </form>
    </main>
  );
}