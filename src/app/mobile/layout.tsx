"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type MobileLayoutProps = {
  children: ReactNode;
};

// Static list of tabs in the bottom nav
const navItems = [
  { href: "/mobile", label: "Home" },
  { href: "/mobile/explore", label: "Explore" },
  { href: "/mobile/chat", label: "Chat" },
  { href: "/mobile/nearby", label: "Nearby" },
  { href: "/mobile/notifications", label: "Alerts" },
  { href: "/mobile/profile", label: "Profile" },
  { href: "/mobile/sos", label: "SOS" },
];

export default function MobileLayout({ children }: MobileLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-white">
      {/* main content */}
      <div className="flex-1 overflow-y-auto">{children}</div>

      {/* bottom nav */}
      <nav className="border-t border-slate-800 bg-slate-950/95 backdrop-blur px-2 py-1 flex justify-around text-[11px]">
        {navItems.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "relative flex flex-col items-center gap-[2px] px-2 py-1 rounded-full transition-colors",
                isActive
                  ? "text-pink-500 font-semibold"
                  : "text-slate-400 hover:text-slate-100",
              ].join(" ")}
            >
              <span>{item.label}</span>

              {/* Simple dot for Alerts when active (we can later tie this to unread count) */}
              {item.label === "Alerts" && isActive && (
                <span className="absolute -top-0.5 right-0 w-1.5 h-1.5 rounded-full bg-pink-500" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
