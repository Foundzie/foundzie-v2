// src/app/admin/MaintenanceToggle.tsx
"use client";

import { useEffect, useState } from "react";

type MaintenanceState = {
  enabled: boolean;
  message: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export default function MaintenanceToggle() {
  const [state, setState] = useState<MaintenanceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadState() {
      try {
        setLoading(true);
        const res = await fetch("/api/admin/maintenance", {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to load maintenance state");
        const data = await res.json();
        if (!cancelled) {
          setState(data.state);
        }
      } catch (err: any) {
        console.error("[MaintenanceToggle] load error:", err);
        if (!cancelled) {
          setError(
            err?.message || "Could not load maintenance state."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadState();
    return () => {
      cancelled = true;
    };
  }, []);

  const enabled = state?.enabled ?? false;

  async function handleToggle() {
    if (saving) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      });
      if (!res.ok) throw new Error("Failed to update maintenance state");
      const data = await res.json();
      setState(data.state);
    } catch (err: any) {
      console.error("[MaintenanceToggle] save error:", err);
      setError(
        err?.message || "Could not update maintenance state."
      );
    } finally {
      setSaving(false);
    }
  }

  const label = enabled ? "On" : "Off";

  return (
    <div className="flex items-center gap-3 text-[11px] text-gray-500">
      <span className="uppercase tracking-wide text-gray-400">
        Maintenance mode:
      </span>

      <button
        type="button"
        onClick={handleToggle}
        disabled={loading || saving}
        className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
          enabled
            ? "bg-orange-500 border-orange-500"
            : "bg-gray-200 border-gray-300"
        } ${loading || saving ? "opacity-60 cursor-not-allowed" : ""}`}
        aria-pressed={enabled}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </button>

      <span
        className={
          enabled ? "text-orange-600 font-semibold" : "text-gray-500"
        }
      >
        {loading ? "Loading…" : label}
      </span>

      {error && (
        <span className="ml-2 text-[10px] text-red-400 max-w-xs truncate">
          {error}
        </span>
      )}
    </div>
  );
}
