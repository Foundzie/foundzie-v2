"use client";

import { useEffect, useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";

export default function MobileSaveButton({ placeId }: { placeId: string }) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function checkSaved() {
      try {
        const res = await fetch("/api/saved", { cache: "no-store" });
        const data = await res.json();
        const items: string[] = Array.isArray(data.items) ? data.items : [];
        setSaved(items.includes(placeId));
      } catch (err) {
        console.error("Failed to check saved status", err);
      }
    }
    checkSaved();
  }, [placeId]);

  const toggle = async () => {
    if (busy) return;
    const next = !saved;
    setSaved(next);
    setBusy(true);

    try {
      await fetch("/api/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: placeId,
          action: next ? "add" : "remove",
        }),
      });
    } catch (err) {
      console.error("Failed to update saved on server", err);
      setSaved(!next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={[
        "fz-btn inline-flex items-center gap-2 px-3 py-2",
        "bg-white hover:bg-slate-50",
        "text-[12px] font-semibold",
        saved ? "text-[var(--primary)]" : "text-slate-700",
        busy ? "opacity-60" : "",
      ].join(" ")}
      aria-label={saved ? "Saved" : "Save"}
    >
      {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
      {saved ? "Saved" : "Save"}
    </button>
  );
}
