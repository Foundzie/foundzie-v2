"use client";

import { useEffect, useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";

export default function MobileSaveButton({ placeId }: { placeId: string }) {
  const [saved, setSaved] = useState(false);

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
    const next = !saved;
    setSaved(next);

    try {
      await fetch("/api/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: placeId, action: next ? "add" : "remove" }),
      });
    } catch (err) {
      console.error("Failed to update saved on server", err);
      setSaved(!next);
    }
  };

  return (
    <button
      onClick={toggle}
      className={[
        "inline-flex items-center gap-2 rounded-full px-3 py-2 text-[12px] font-semibold",
        "border border-slate-200 bg-white",
        "shadow-[0_10px_22px_rgba(15,23,42,0.10)] active:scale-[0.99] transition",
        saved ? "text-blue-600" : "text-slate-700",
      ].join(" ")}
      aria-label={saved ? "Saved" : "Save"}
    >
      {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
      {saved ? "Saved" : "Save"}
    </button>
  );
}
