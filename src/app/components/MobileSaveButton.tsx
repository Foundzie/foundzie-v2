// src/app/components/MobileSaveButton.tsx
"use client";

import { useEffect, useState } from "react";

export default function MobileSaveButton({ placeId }: { placeId: string }) {
  const [saved, setSaved] = useState(false);

  // on mount, check if this place is already saved
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
    setSaved(next); // update UI first

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
      // optional: revert
      setSaved(!next);
    }
  };

  return (
    <button
      onClick={toggle}
      className={saved ? "text-sm text-yellow-400" : "text-sm text-slate-400"}
    >
      {saved ? "★ Saved" : "☆ Save"}
    </button>
  );
}