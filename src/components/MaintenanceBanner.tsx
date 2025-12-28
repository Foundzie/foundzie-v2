"use client";

import { useEffect, useState } from "react";

type MaintenanceState = {
  enabled: boolean;
  message: string | null;
};

export function MaintenanceBannerMobile({ className = "" }: { className?: string }) {
  const [state, setState] = useState<MaintenanceState | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/admin/maintenance", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.state) {
          setState({
            enabled: !!data.state.enabled,
            message: data.state.message ?? null,
          });
        }
      } catch {
        // ignore
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
      className={[
        "mx-4 mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3",
        "shadow-[0_6px_18px_rgba(15,23,42,0.08)]",
        className,
      ].join(" ")}
    >
      <p className="text-[12px] font-semibold text-amber-900">
        Maintenance in progress
      </p>
      <p className="mt-1 text-[12px] text-amber-800 leading-snug">
        {state.message || "Foundzie is in maintenance right now. Some features may be limited."}
      </p>
    </div>
  );
}
