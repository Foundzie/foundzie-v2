"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type CampaignStatus = "draft" | "active" | "paused" | "ended";
type CampaignChannel = "push" | "call" | "hybrid";

type Campaign = {
  id: string;
  name: string;
  advertiserName: string;
  status: CampaignStatus;
  channels: CampaignChannel[];
  updatedAt: string;
  creative: { title: string; message: string; actionHref?: string; mediaUrl?: string };
  schedule?: { startAt?: string | null; endAt?: string | null };
};

export default function AdminCampaignsPage() {
  const [items, setItems] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/campaigns", { cache: "no-store" });
      const j = await res.json();
      setItems(j?.items ?? []);
    } catch (e) {
      console.error("Failed to load campaigns", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function deliverNow(id: string) {
    try {
      const res = await fetch(`/api/campaigns?deliver=1&force=1`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }), // upsert finds & returns existing, then deliver
      });
      const j = await res.json();
      if (!j?.delivery?.ok) {
        alert(`Delivery skipped: ${j?.delivery?.reason || "unknown"}`);
      } else {
        alert("✅ Push delivered (notification created).");
      }
    } catch (e) {
      console.error("deliverNow failed", e);
      alert("Delivery failed (see console).");
    } finally {
      load();
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="w-full bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Campaigns</h1>
          <p className="text-xs text-gray-500">
            Sponsored Promotions (M21). Push delivery v1 reuses <code>/api/notifications</code>.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/admin/notifications"
            className="bg-white border border-gray-200 text-gray-700 text-sm px-4 py-2 rounded-md hover:bg-gray-50"
          >
            Notifications
          </Link>
          <Link
            href="/admin/campaigns/new"
            className="bg-purple-600 text-white text-sm px-4 py-2 rounded-md hover:bg-purple-700"
          >
            + New Campaign
          </Link>
        </div>
      </header>

      <section className="px-6 py-6">
        <div className="bg-white border border-gray-200 rounded-lg">
          <ul className="divide-y divide-gray-100">
            {loading ? (
              <li className="p-6 text-sm text-gray-400">Loading…</li>
            ) : items.length === 0 ? (
              <li className="p-6 text-sm text-gray-400">No campaigns yet.</li>
            ) : (
              items.map((c) => (
                <li key={c.id} className="px-4 py-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {c.name || "(untitled)"}{" "}
                        <span className="text-gray-400 font-normal">— {c.advertiserName || "Advertiser"}</span>
                      </p>
                      <span className="text-[10px] uppercase tracking-wide bg-gray-100 text-gray-600 px-2 py-[2px] rounded">
                        {c.status}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide bg-purple-50 text-purple-700 px-2 py-[2px] rounded">
                        {Array.isArray(c.channels) ? c.channels.join("+") : "push"}
                      </span>
                    </div>

                    <p className="text-xs text-gray-500 truncate">
                      {c.creative?.title ? `${c.creative.title}: ` : ""}
                      {c.creative?.message || ""}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Updated: {new Date(c.updatedAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => deliverNow(c.id)}
                      className="text-xs bg-purple-600 text-white px-3 py-2 rounded-md hover:bg-purple-700"
                    >
                      Deliver push now
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

        <Link
          href="/admin"
          className="inline-block mt-4 text-[11px] text-gray-400 hover:text-gray-600"
        >
          ← back to admin
        </Link>
      </section>
    </main>
  );
}
