"use client";

import { useState } from "react";
import Link from "next/link";

type CampaignStatus = "draft" | "active" | "paused" | "ended";

export default function AdminNewCampaignPage() {
  const [name, setName] = useState("");
  const [advertiserName, setAdvertiserName] = useState("");
  const [status, setStatus] = useState<CampaignStatus>("draft");

  const [channels, setChannels] = useState<{ push: boolean; call: boolean; hybrid: boolean }>({
    push: true,
    call: false,
    hybrid: false,
  });

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [actionLabel, setActionLabel] = useState("View");
  const [actionHref, setActionHref] = useState("/mobile/explore");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaKind, setMediaKind] = useState<"image" | "gif" | "other" | "">("");

  const [startAt, setStartAt] = useState(""); // ISO input (optional)
  const [endAt, setEndAt] = useState("");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function selectedChannels(): string[] {
    const out: string[] = [];
    if (channels.hybrid) out.push("hybrid");
    else {
      if (channels.push) out.push("push");
      if (channels.call) out.push("call");
    }
    return out.length ? out : ["push"];
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    const deliver = status === "active" && (channels.push || channels.hybrid);

    const res = await fetch(`/api/campaigns${deliver ? "?deliver=1" : ""}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        advertiserName,
        status,
        channels: selectedChannels(),
        schedule: {
          startAt: startAt || null,
          endAt: endAt || null,
        },
        targeting: {}, // v1 (we’ll expand targeting in M21b.2)
        creative: {
          title,
          message,
          actionLabel,
          actionHref,
          mediaUrl: mediaUrl || "",
          mediaKind: mediaKind || null,
        },
        budgetTier: "basic",
      }),
    });

    if (res.ok) {
      setSaved(true);
      setName("");
      setAdvertiserName("");
      setStatus("draft");
      setChannels({ push: true, call: false, hybrid: false });
      setTitle("");
      setMessage("");
      setActionLabel("View");
      setActionHref("/mobile/explore");
      setMediaUrl("");
      setMediaKind("");
      setStartAt("");
      setEndAt("");
    } else {
      alert("Could not save campaign.");
    }

    setSaving(false);
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="w-full bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">New campaign</h1>
          <p className="text-xs text-gray-500">
            M21 Sponsored Promotions. Push delivery v1 will emit into <code>/api/notifications</code>.
          </p>
        </div>
        <Link href="/admin/campaigns" className="text-[10px] text-gray-400 hover:text-gray-600">
          ← back to campaigns
        </Link>
      </header>

      <section className="px-6 py-6">
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-5 max-w-xl space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Campaign name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              placeholder="Lunch promo - Westmont"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Advertiser name</label>
            <input
              value={advertiserName}
              onChange={(e) => setAdvertiserName(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              placeholder="GMEA"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CampaignStatus)}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="draft">draft</option>
              <option value="active">active (deliver now if push)</option>
              <option value="paused">paused</option>
              <option value="ended">ended</option>
            </select>
            <p className="text-[10px] text-gray-400 mt-1">
              If you set <b>active</b> and channel includes <b>push</b>, it will create a notification immediately.
            </p>
          </div>

          <div className="border border-gray-100 rounded-md p-3">
            <p className="text-xs font-medium text-gray-700 mb-2">Channels</p>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={channels.push}
                  disabled={channels.hybrid}
                  onChange={(e) => setChannels((s) => ({ ...s, push: e.target.checked }))}
                />
                Push
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={channels.call}
                  disabled={channels.hybrid}
                  onChange={(e) => setChannels((s) => ({ ...s, call: e.target.checked }))}
                />
                Call mention
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={channels.hybrid}
                  onChange={(e) =>
                    setChannels((s) => ({
                      push: e.target.checked ? true : s.push,
                      call: e.target.checked ? true : s.call,
                      hybrid: e.target.checked,
                    }))
                  }
                />
                Hybrid
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Creative title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              placeholder="15% off lunch near you"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Creative message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              required
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              placeholder="You’re near GMEA in Westmont. Want to book a table?"
            />
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Action label</label>
              <input
                value={actionLabel}
                onChange={(e) => setActionLabel(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Action href</label>
              <input
                value={actionHref}
                onChange={(e) => setActionHref(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Media URL (optional)</label>
              <input
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                placeholder="https://example.com/image.jpg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Media kind</label>
              <select
                value={mediaKind}
                onChange={(e) => setMediaKind(e.target.value as any)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="">None</option>
                <option value="image">Image</option>
                <option value="gif">GIF</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="border border-gray-100 rounded-md p-3">
            <p className="text-xs font-medium text-gray-700 mb-2">Schedule (optional)</p>
            <div className="grid grid-cols-1 gap-3">
              <input
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                placeholder="startAt ISO (e.g. 2026-02-01T18:00:00.000Z)"
              />
              <input
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                placeholder="endAt ISO"
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              v1 uses schedule as a gate (no cron yet). We’ll add real scheduling later.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="bg-purple-600 text-white text-sm px-4 py-2 rounded-md hover:bg-purple-700 transition disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save campaign"}
          </button>

          {saved && <p className="text-xs text-green-600">✅ Campaign saved.</p>}
        </form>
      </section>
    </main>
  );
}
