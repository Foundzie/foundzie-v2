"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect } from "react";
import OnboardingGate from "./OnboardingGate";
import GetAppButton from "@/app/components/GetAppButton";

type MobileLayoutProps = {
  children: ReactNode;
};

const navItems = [
  { href: "/mobile", label: "Home" },
  { href: "/mobile/explore", label: "Explore" },
  { href: "/mobile/chat", label: "Chat" },
  { href: "/mobile/nearby", label: "Nearby" },
  { href: "/mobile/notifications", label: "Alerts" },
  { href: "/mobile/profile", label: "Profile" },
  { href: "/mobile/sos", label: "SOS" },
  // quick link into admin for you while developing
  { href: "/admin", label: "Admin" },
];

const LS_ENGAGEMENT = "foundzie:engagement:count";

function bumpEngagement() {
  try {
    const raw = window.localStorage.getItem(LS_ENGAGEMENT);
    const n = Number(raw || "0");
    const next = Number.isFinite(n) ? n + 1 : 1;
    window.localStorage.setItem(LS_ENGAGEMENT, String(next));
  } catch {
    // ignore
  }
}

export default function MobileLayout({ children }: MobileLayoutProps) {
  const pathname = usePathname();

  // engagement bump on route changes (used for Install CTA timing)
  useEffect(() => {
    if (typeof window === "undefined") return;
    bumpEngagement();
  }, [pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-white">
      {/* main content with onboarding gate */}
      <div className="flex-1 overflow-y-auto">
        <OnboardingGate>
          {/* Smart Install CTA (M12d) */}
          <GetAppButton variant="banner" />

          {children}
        </OnboardingGate>
      </div>

      {/* bottom nav */}
      <nav className="sticky bottom-0 inset-x-0 border-t border-slate-800 bg-slate-950/95 backdrop-blur-md">
        <div className="mx-auto max-w-md px-2 py-1.5 flex justify-between gap-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href === "/mobile" && pathname === "/mobile");

            const isPrimary = item.label === "Home" || item.label === "Explore";

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "flex-1 flex flex-col items-center justify-center gap-[2px] px-2 py-1 rounded-full transition-all text-[10px]",
                  isActive
                    ? "text-pink-400"
                    : "text-slate-400 hover:text-slate-100",
                  isPrimary && "max-w-[72px]",
                ].join(" ")}
              >
                <span
                  className={[
                    "px-2 py-1 rounded-full border text-[11px] leading-none",
                    isActive
                      ? "border-pink-500 bg-pink-500/10"
                      : "border-transparent bg-slate-900/40",
                  ].join(" ")}
                >
                  {item.label}
                </span>

                {item.label === "Alerts" && isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
