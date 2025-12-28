"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import OnboardingGate from "./OnboardingGate";
import GetAppButton from "@/app/components/GetAppButton";
import BottomNav from "@/app/components/BottomNav";

type MobileLayoutProps = { children: ReactNode };

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    bumpEngagement();
  }, [pathname]);

  return (
    <div className="h-[100dvh] w-full bg-white">
      {/* Centered mobile “device width” on desktop, full width on phone */}
      <div className="mx-auto h-[100dvh] max-w-md bg-white shadow-[0_10px_40px_rgba(15,23,42,0.08)]">
        {/* Scroll area inside the app */}
        <div className="app-scroll h-[calc(100dvh-72px)] overflow-y-auto">
          <OnboardingGate>
            <div className="safe-t" />
            <GetAppButton variant="banner" />
            {children}
            <div className="h-6" />
          </OnboardingGate>
        </div>

        {/* Bottom Nav */}
        <div className="h-[72px]">
          <BottomNav />
        </div>
      </div>
    </div>
  );
}
