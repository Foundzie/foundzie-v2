// src/app/mobile/concierge/page.tsx
"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";

export default function MobileConciergePage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const parts: string[] = [];

      if (note.trim().length > 0) {
        parts.push(note.trim());
      }
      if (phone.trim().length > 0) {
        parts.push(`Phone: ${phone.trim()}`);
      }

      const interest =
        parts.join(" | ") || "Concierge request (no extra details)";

      await fetch("/api/users/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || "Anonymous visitor",
          email: "no-email@example.com",
          interest,
          source: "mobile-concierge",
          tags: ["concierge-request"],
        }),
      });

      setSaved(true);
      setName("");
      setPhone("");
      setNote("");
    } catch (err) {
      console.error("Failed to send concierge request", err);
      setError("Could not send your request. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white pb-14">
      <header className="px-4 py-4 border-b border-slate-800 flex items-center gap-2">
        <Link href="/mobile/nearby" className="text-xs text-slate-400">
          &larr; Back
        </Link>
        <h1 className="text-lg font-semibold">Talk to concierge</h1>
      </header>

      <section className="px-4 py-4 space-y-4">
        <p className="text-xs text-slate-400">
          Share a few details and we&apos;ll have a concierge reach out via call
          or message.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400"
              placeholder="e.g. Kashif"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Phone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400"
              placeholder="e.g. +1 312 555 0123"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">
              What do you need?
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400 min-h-[80px]"
              placeholder="Dinner tonight, club recommendations, cancel a booking, talk to someone, etc."
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-purple-600 rounded-lg py-2 text-sm font-medium disabled:opacity-60"
          >
            {saving ? "Sending..." : "Send request"}
          </button>
        </form>

        {saved && (
          <p className="text-[11px] text-emerald-400">
            Request sent! We&apos;ll contact you shortly.
          </p>
        )}
        {error && <p className="text-[11px] text-red-400">{error}</p>}
      </section>

      <nav className="fixed bottom-0 left-0 right-0 bg-slate-950 border-t border-slate-800 flex justify-around py-2 text-xs text-slate-300">
        <Link href="/mobile">Home</Link>
        <Link href="/mobile/explore">Explore</Link>
        <Link href="/mobile/nearby">Nearby</Link>
        <Link href="/mobile/profile">Profile</Link>
        <Link href="/admin">Admin</Link>
      </nav>
    </main>
  );
}
