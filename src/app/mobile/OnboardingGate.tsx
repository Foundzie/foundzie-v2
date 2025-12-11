// src/app/mobile/OnboardingGate.tsx
"use client";

import { useEffect, useState, type ReactNode } from "react";

type OnboardingGateProps = {
  children: ReactNode;
};

const INTEREST_OPTIONS = [
  { id: "food", label: "Food & brunch" },
  { id: "coffee", label: "Coffee" },
  { id: "family", label: "Family fun" },
  { id: "night", label: "Night out" },
  { id: "music", label: "Live music" },
  { id: "outdoors", label: "Outdoors" },
];

const LOCAL_KEY = "foundzie:onboarded:v1";

export default function OnboardingGate({ children }: OnboardingGateProps) {
  const [checked, setChecked] = useState(false);
  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(LOCAL_KEY);
      if (!raw) {
        setOpen(true);
      } else {
        // Optional: could hydrate fields from previous session
        setOpen(false);
      }
    } catch {
      setOpen(true);
    } finally {
      setChecked(true);
    }
  }, []);

  const toggleInterest = (id: string) => {
    setInterests((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (saving) return;

    setSaving(true);
    setError(null);

    const trimmedName = name.trim() || "Guest";
    const trimmedCity = city.trim();

    const interestLabels = INTEREST_OPTIONS.filter((opt) =>
      interests.includes(opt.id)
    ).map((opt) => opt.label);

    const combinedInterest =
      interestLabels.length > 0 ? interestLabels.join(", ") : "";

    const tags: string[] = [];

    if (trimmedCity) tags.push(`city:${trimmedCity}`);
    tags.push(...interestLabels);

    try {
      await fetch("/api/users/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          city: trimmedCity || undefined,
          interests: interestLabels,
          interest: combinedInterest,
          source: "mobile-onboarding",
          tags,
        }),
      });

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          LOCAL_KEY,
          JSON.stringify({
            name: trimmedName,
            city: trimmedCity,
            interests: interestLabels,
            at: new Date().toISOString(),
          })
        );
      }

      setOpen(false);
    } catch (err) {
      console.error("[Onboarding] failed to collect user", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          LOCAL_KEY,
          JSON.stringify({
            skipped: true,
            at: new Date().toISOString(),
          })
        );
      }
    } catch {
      // ignore
    }
    setOpen(false);
  };

  // Until we've checked localStorage, just render children
  if (!checked) {
    return <>{children}</>;
  }

  return (
    <>
      {children}

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/80 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-pink-500/15 via-purple-500/10 to-sky-500/15 px-5 py-4 border-b border-slate-800">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400 mb-1">
                Welcome to Foundzie
              </p>
              <h2 className="text-lg font-semibold text-slate-50">
                Let&apos;s tune your concierge
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                A few quick questions so we can recommend better places from
                your very first session.
              </p>
            </div>

            <div className="px-5 py-4 space-y-4 text-slate-50">
              {/* Name */}
              <div className="space-y-1">
                <label className="text-xs text-slate-300">
                  What should we call you?
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Kashif, KNY"
                  className="w-full rounded-xl bg-slate-900/80 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-pink-400 focus:ring-1 focus:ring-pink-500/60"
                />
              </div>

              {/* City */}
              <div className="space-y-1">
                <label className="text-xs text-slate-300">
                  Which city are you exploring from?
                </label>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Downers Grove, Chicago"
                  className="w-full rounded-xl bg-slate-900/80 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-pink-400 focus:ring-1 focus:ring-pink-500/60"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  We&apos;ll soon add a &quot;Use my location&quot; button here.
                </p>
              </div>

              {/* Interests chips */}
              <div className="space-y-2">
                <label className="text-xs text-slate-300">
                  What are you usually in the mood for?
                </label>
                <div className="flex flex-wrap gap-2">
                  {INTEREST_OPTIONS.map((opt) => {
                    const active = interests.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => toggleInterest(opt.id)}
                        className={[
                          "px-3 py-1.5 rounded-full text-xs border transition-all",
                          active
                            ? "bg-pink-500 text-white border-pink-400 shadow-sm shadow-pink-500/40"
                            : "bg-slate-900/80 border-slate-700 text-slate-300 hover:border-slate-400",
                        ].join(" ")}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && (
                <p className="text-[11px] text-amber-300">{error}</p>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleSkip}
                  className="text-[11px] text-slate-400 underline underline-offset-2"
                >
                  Skip for now
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-pink-500 text-xs font-medium text-white shadow-md shadow-pink-500/40 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save & continue"}
                </button>
              </div>

              <p className="text-[10px] text-slate-500 pt-1">
                No login required. We just create a lightweight visitor profile
                so your concierge and admin panel can recognise you.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
