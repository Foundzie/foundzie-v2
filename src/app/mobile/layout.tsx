"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect } from "react";
import OnboardingGate from "./OnboardingGate";
import GetAppButton from "@/app/components/GetAppButton";
import { MaintenanceBannerMobile } from "@/components/MaintenanceBanner";

import {
  Home,
  Compass,
  MessageCircle,
  MapPin,
  Bell,
  User,
  Siren,
  Shield,
} from "lucide-react";

type MobileLayoutProps = {
  children: ReactNode;
};

const navItems = [
  { href: "/mobile", label: "Home", icon: Home },
  { href: "/mobile/explore", label: "Explore", icon: Compass },
  { href: "/mobile/chat", label: "Chat", icon: MessageCircle },
  { href: "/mobile/nearby", label: "Nearby", icon: MapPin },
  { href: "/mobile/notifications", label: "Alerts", icon: Bell },
  { href: "/mobile/profile", label: "Profile", icon: User },
  { href: "/mobile/sos", label: "SOS", icon: Siren },
  { href: "/admin", label: "Admin", icon: Shield }, // dev-only link
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    bumpEngagement();
  }, [pathname]);

  return (
    <div className="app-screen safe-area bg-[var(--bg)] text-[var(--text)] overflow-x-hidden">
      {/* Centered app canvas like premium apps */}
      <div className="mx-auto h-full w-full max-w-md flex flex-col">
        {/* Content area (native scroll) */}
        <div className="flex-1 overflow-y-auto native-scroll px-4 pt-3 pb-24">
          <OnboardingGate>
            {/* Maintenance banner (stays inside screen) */}
            <MaintenanceBannerMobile className="mb-3" />

            {/* Smart Install CTA (banner style) */}
            <GetAppButton variant="banner" />

            {children}
          </OnboardingGate>
        </div>

        {/* Bottom nav: elevated, app-like, icon-first */}
        <nav
          className={[
            "fixed left-1/2 -translate-x-1/2 bottom-3",
            "w-[calc(100%-24px)] max-w-md",
            "rounded-2xl bg-white/90 backdrop-blur-md",
            "border border-[rgba(15,23,42,0.10)]",
            "shadow-[0_14px_40px_rgba(15,23,42,0.14)]",
          ].join(" ")}
          style={{
            paddingBottom: "calc(10px + var(--safe-bottom))",
          }}
        >
          <div className="grid grid-cols-8 gap-1 px-2 pt-2">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href === "/mobile" && pathname === "/mobile");

              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "flex flex-col items-center justify-center",
                    "py-2 rounded-xl transition-all",
                    isActive ? "bg-[rgba(37,99,235,0.10)]" : "hover:bg-black/5",
                  ].join(" ")}
                >
                  <Icon
                    size={18}
                    className={isActive ? "text-[var(--primary)]" : "text-slate-500"}
                  />
                  <span
                    className={[
                      "mt-1 text-[10px] leading-none",
                      isActive ? "text-[var(--primary)] font-semibold" : "text-slate-500",
                    ].join(" ")}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
