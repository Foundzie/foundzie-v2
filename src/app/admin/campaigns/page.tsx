"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type CampaignStatus = "draft" | "active" | "paused" | "ended";
type CampaignChannel = "push" | "call" | "hybrid";

type DeliveryResult = {
  ok?: boolean;
  mode?: "broadcast" | "targeted";
  reason?: string;

  ranAt?: string;
  lastDeliveredAt?: string | null;

  targetCount?: number;
  deliveredCount?: number;
  skippedCount?: number;

  skippedByReason?: Record<string, number>;
  skippedRooms?: Array<{ roomId: string; reason: string }>;

  stats?: any;
};

type Campaign = {
  id: string;
  name: string;
  advertiserName: string;
  status: CampaignStatus;
  channels: CampaignChannel[];
  updatedAt: string;
  creative: { title: string; message: string; actionHref?: string; mediaUrl?: string };
  targeting?: { city?: string; tags?: string[]; roomIds?: string[] };
};

export default function AdminCampaignsPage() {
  const [items, setItems] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  // Store last delivery response per campaign in UI
  const [lastDelivery, setLastDelivery] = useState<Record<string, DeliveryResult>>({});

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
        body: JSON.stringify({ id }),
      });
      const j = await res.json();
      const d = (j?.delivery ?? null) as DeliveryResult | null;

      if (!d?.ok) {
        setLastDelivery((prev) => ({
          ...prev,
          [id]: { ok: false, reason: d?.reason || "unknown" },
        }));
        alert(`Delivery skipped: ${d?.reason || "unknown"}`);
      } else {
        setLastDelivery((prev) => ({ ...prev, [id]: d }));
        const delivered = Number(d?.deliveredCount || 0);
        const skipped = Number(d?.skippedCount || 0);
        alert(`✅ Delivered ${delivered}. Skipped ${skipped}.`);
      }
    } catch (e) {
      console.error("deliverNow failed", e);
      setLastDelivery((prev) => ({ ...prev, [id]: { ok: false, reason: "request_failed" } }));
      alert("Delivery failed (see console).");
    } finally {
      load();
    }
  }

  function targetingSummary(c: Campaign) {
    const city = (c.targeting?.city || "").trim();
    const tags = Array.isArray(c.targeting?.tags) ? c.targeting!.tags : [];
    const rooms = Array.isArray(c.targeting?.roomIds) ? c.targeting!.roomIds : [];

    const parts: string[] = [];
    if (rooms.length) parts.push(`rooms=${rooms.length}`);
    if (city) parts.push(`city=${city}`);
    if (tags.length) parts.push(`tags=${tags.join(",")}`);
    return parts.length ? parts.join(" · ") : "broadcast";
  }

  function formatBreakdown(map?: Record<string, number>) {
    if (!map) return "";
    const entries = Object.entries(map).filter(([, v]) => Number(v) > 0);
    if (!entries.length) return "";
    return entries
      .sort((a, b) => (b[1] || 0) - (a[1] || 0))
      .map(([k, v]) => `${k}:${v}`)
      .join(" · ");
  }

  const rows = useMemo(() => items, [items]);

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="w-full bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Campaigns</h1>
          <p className="text-xs text-gray-500">
            Sponsored Promotions (M21). Push delivery uses <code>/api/notifications</code>.
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
            ) : rows.length === 0 ? (
              <li className="p-6 text-sm text-gray-400">No campaigns yet.</li>
            ) : (
              rows.map((c) => {
                const d = lastDelivery[c.id];
                const breakdown = formatBreakdown(d?.skippedByReason);

                return (
                  <li key={c.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-4">
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

                        <p className="text-[10px] text-gray-400 mt-1">Targeting: {targetingSummary(c)}</p>

                        <p className="text-[10px] text-gray-400 mt-1">
                          Updated: {new Date(c.updatedAt).toLocaleString()}
                        </p>

                        {d && (
                          <div className="mt-2 text-[11px] text-gray-600">
                            <div className="flex flex-wrap gap-2">
                              <span className="px-2 py-[2px] rounded bg-green-50 text-green-700 border border-green-100">
                                Delivered: {Number(d.deliveredCount || 0)}
                              </span>
                              <span className="px-2 py-[2px] rounded bg-yellow-50 text-yellow-800 border border-yellow-100">
                                Skipped: {Number(d.skippedCount || 0)}
                              </span>
                              {typeof d.targetCount === "number" && (
                                <span className="px-2 py-[2px] rounded bg-gray-50 text-gray-700 border border-gray-100">
                                  Targets: {d.targetCount}
                                </span>
                              )}
                              {breakdown && (
                                <span className="px-2 py-[2px] rounded bg-gray-50 text-gray-700 border border-gray-100">
                                  Reasons: {breakdown}
                                </span>
                              )}
                            </div>
                            {d.ranAt && (
                              <div className="mt-1 text-[10px] text-gray-400">
                                Last run: {new Date(d.ranAt).toLocaleString()}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => deliverNow(c.id)}
                          className="text-xs bg-purple-600 text-white px-3 py-2 rounded-md hover:bg-purple-700"
                        >
                          Deliver push now
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        <Link href="/admin" className="inline-block mt-4 text-[11px] text-gray-400 hover:text-gray-600">
          ← back to admin
        </Link>
      </section>
    </main>
  );
}
