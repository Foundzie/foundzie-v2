"use client";

import { useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";

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
        // ignore on mobile; banner is informational
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
        "fz-card",
        "px-3 py-2",
        "flex items-start gap-2",
        "border-amber-200 bg-amber-50",
        className,
      ].join(" ")}
    >
      <div className="mt-[2px]">
        <TriangleAlert size={16} className="text-amber-600" />
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-[12px] text-amber-900">
          Maintenance in progress
        </p>
        <p className="text-[12px] leading-snug text-amber-900/80">
          {state.message ||
            "Foundzie is in maintenance right now. Some features may be limited."}
        </p>
      </div>
    </div>
  );
}
