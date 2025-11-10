// src/components/MobileSaveButton.tsx
"use client";

import { useState } from "react";

export default function MobileSaveButton({ placeId }: { placeId: string }) {
  const [saved, setSaved] = useState(false);

  return (
    <button
      onClick={() => setSaved((prev) => !prev)}
      className={saved ? "text-sm text-yellow-400" : "text-sm text-slate-400"}
    >
      {saved ? "★ Saved" : "☆ Save"}
    </button>
  );
}