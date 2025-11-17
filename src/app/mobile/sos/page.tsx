// src/app/mobile/sos/page.tsx
"use client";

import { FormEvent, useEffect, useState } from "react";
import sosContacts from "@/app/data/sos";
import Link from "next/link";

const typeColors: Record<string, string> = {
  police: "bg-red-100 text-red-700",
  medical: "bg-green-100 text-green-700",
  fire: "bg-orange-100 text-orange-700",
  general: "bg-purple-100 text-purple-700",
};

type SosType = "police" | "medical" | "fire" | "general";

type SosStatus = "new" | "in-progress" | "resolved";

interface SosEvent {
  id: string;
  type: string;
  message: string;
  status: SosStatus;
  createdAt: string;
  location?: string | null;
  source?: string | null;
  phone?: string | null;
}

const statusLabels: Record<SosStatus, string> = {
  new: "New",
  "in-progress": "In progress",
  resolved: "Resolved",
};

const statusColors: Record<SosStatus, string> = {
  new: "bg-red-100 text-red-700",
  "in-progress": "bg-amber-100 text-amber-700",
  resolved: "bg-emerald-100 text-emerald-700",
};

export default function SosPage() {
  const [message, setMessage] = useState("");
  const [sosType, setSosType] = useState<SosType>("general");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lastEvent, setLastEvent] = useState<SosEvent | null>(null);
  const [loadingLast, setLoadingLast] = useState(false);

  async function loadLastEvent() {
    try {
      setLoadingLast(true);
      const res = await fetch("/api/sos", { cache: "no-store" });
      const data = await res.json().catch(() => ({} as any));

      if (!res.ok || !Array.isArray(data.items)) {
        return;
      }

      const all = data.items as SosEvent[];

      // For now: pick the most recent SOS from the mobile app
      const fromMobile = all.filter(
        (e) => (e.source ?? "mobile-sos") === "mobile-sos"
      );

      if (fromMobile.length === 0) {
        setLastEvent(null);
        return;
      }

      const latest = fromMobile.sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      )[0];

      setLastEvent(latest);
    } finally {
      setLoadingLast(false);
    }
  }

  useEffect(() => {
    // Load last SOS on page load
    loadLastEvent();
  }, []);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const text = message.trim();
    if (!text || sending) return;

    setSending(true);
    setSent(false);
    setError(null);

    try {
      const res = await fetch("/api/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          type: sosType,
          source: "mobile-sos",
        }),
      });

      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Failed to send SOS");
      }

      setSent(true);
      setMessage("");

      // Refresh last-event box
      await loadLastEvent();
    } catch (err: any) {
      console.error("SOS send error", err);
      setError(err?.message || "Could not send SOS. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-white pb-20">
      {/* header */}
      <header className="px-4 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">SOS / Emergency</h1>
          <p className="text-xs text-gray-500">
            Quick contacts near you &amp; instant SOS alert to Foundzie.
          </p>
        </div>

        <Link href="/mobile" className="text-purple-600 text-sm underline">
          back
        </Link>
      </header>

      {/* SEND SOS BOX */}
      <section className="px-4 py-4 space-y-3 border-b border-gray-100 bg-slate-50">
        <h2 className="text-sm font-semibold text-gray-800">
          Need urgent help right now?
        </h2>
        <p className="text-xs text-gray-500">
          Describe what&apos;s happening. Foundzie will alert a concierge and
          local emergency services.
        </p>

        {/* type selector */}
        <div className="flex gap-2">
          {(["general", "police", "medical", "fire"] as SosType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSosType(t)}
              className={[
                "text-[11px] px-2 py-1 rounded-full border",
                sosType === t
                  ? "bg-purple-600 text-white border-purple-600"
                  : "bg-white text-slate-600 border-slate-200",
              ].join(" ")}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        <form onSubmit={handleSend} className="space-y-3">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full text-xs bg-white text-slate-900 border border-slate-200 rounded-lg p-2 outline-none focus:border-purple-500 min-h-[80px]"
            placeholder="Example: I was in a car accident, I am near Oak Street & 5th, I need an ambulance."
          />

          {error && (
            <p className="text-[11px] text-red-500 font-medium">{error}</p>
          )}
          {sent && !error && (
            <p className="text-[11px] text-emerald-600 font-medium">
              SOS sent. A concierge is being notified and will assist you.
            </p>
          )}

          <button
            type="submit"
            disabled={sending || !message.trim()}
            className={[
              "w-full text-xs font-medium rounded-lg py-2",
              sending || !message.trim()
                ? "bg-purple-300 text-white cursor-not-allowed"
                : "bg-purple-600 text-white",
            ].join(" ")}
          >
            {sending ? "Sending SOS..." : "Send emergency alert"}
          </button>
        </form>

        {/* LAST SOS STATUS BOX */}
        {loadingLast && (
          <p className="text-[11px] text-slate-500">
            Checking your last SOS status…
          </p>
        )}

        {!loadingLast && lastEvent && (
          <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-slate-700">
                Last SOS status
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full ${
                  statusColors[lastEvent.status]
                }`}
              >
                {statusLabels[lastEvent.status]}
              </span>
            </div>
            <p className="text-[11px] text-slate-600">
              {lastEvent.message || "No details available."}
            </p>
            <p className="text-[10px] text-slate-400">
              {new Date(lastEvent.createdAt).toLocaleString()}
            </p>
          </div>
        )}
      </section>

      {/* EXISTING CONTACT LIST */}
      <section className="px-4 py-4 space-y-3">
        {sosContacts.map((c: any) => (
          <div
            key={c.id}
            className="border border-gray-100 rounded-xl p-3 flex items-start justify-between shadow-sm"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-900">
                  {c.name}
                </h2>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ${
                    typeColors[c.type] || "bg-gray-100 text-gray-600"
                  }`}
                >
                  {c.type.toUpperCase()}
                </span>
              </div>

              <p className="text-xs text-gray-500">{c.role}</p>
              {c.notes ? (
                <p className="text-[10px] text-gray-400">{c.notes}</p>
              ) : null}
              {c.distance ? (
                <p className="text-[10px] text-gray-400">{c.distance}</p>
              ) : null}
            </div>

            <div className="mt-1">
              <a
                href={`tel:${c.phone}`}
                className="bg-purple-600 text-white text-xs px-3 py-2 rounded-lg font-medium"
              >
                Call {c.phone}
              </a>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
