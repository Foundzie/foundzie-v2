// src/components/MaintenanceBanner.tsx
"use client";

import { useEffect, useState } from "react";

type MaintenanceState = {
  enabled: boolean;
  message: string | null;
};

export function MaintenanceBannerMobile({
  className = "",
}: {
  className?: string;
}) {
  const [state, setState] = useState<MaintenanceState | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/admin/maintenance", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.state) {
          setState({
            enabled: !!data.state.enabled,
            message: data.state.message ?? null,
          });
        }
      } catch {
        // silently ignore on mobile; banner is purely informational
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state || !state.enabled) return null;

  return (
    <div
      className={`mb-3 rounded-xl border border-amber-400 bg-amber-50 px-3 py-2 text-xs text-amber-900 shadow-sm ${className}`}
    >
      <p className="font-semibold text-[11px] mb-0.5">
        Maintenance in progress
      </p>
      <p className="text-[11px] leading-snug">
        {state.message ||
          "Foundzie is in maintenance right now. Some features may be limited."}
      </p>
    </div>
  );
}
