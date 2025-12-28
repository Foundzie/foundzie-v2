"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Bell, User, Siren } from "lucide-react";

const items = [
  { href: "/mobile", label: "Home", icon: Home },
  { href: "/mobile/explore", label: "Explore", icon: Compass },
  { href: "/mobile/notifications", label: "Alerts", icon: Bell },
  { href: "/mobile/profile", label: "Profile", icon: User },
  { href: "/mobile/sos", label: "SOS", icon: Siren },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className={[
        "fixed left-1/2 -translate-x-1/2 bottom-3 z-50",
        "w-[calc(100%-24px)] max-w-md",
        "rounded-2xl bg-white/90 backdrop-blur-md",
        "border border-[rgba(15,23,42,0.10)]",
        "shadow-[0_14px_40px_rgba(15,23,42,0.14)]",
      ].join(" ")}
      style={{
        paddingBottom: "calc(10px + var(--safe-bottom))",
      }}
      aria-label="Bottom navigation"
    >
      <div className="grid grid-cols-5 gap-1 px-2 pt-2">
        {items.map((item) => {
          const active =
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
                active ? "bg-[rgba(37,99,235,0.10)]" : "hover:bg-black/5",
              ].join(" ")}
            >
              <Icon
                size={18}
                className={active ? "text-[var(--primary)]" : "text-slate-500"}
              />
              <span
                className={[
                  "mt-1 text-[10px] leading-none",
                  active ? "text-[var(--primary)] font-semibold" : "text-slate-500",
                ].join(" ")}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
