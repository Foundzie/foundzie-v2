"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Search,
  MessageCircle,
  MapPin,
  Bell,
  User,
  ShieldAlert,
} from "lucide-react";

const items = [
  { href: "/mobile", label: "Home", Icon: Home },
  { href: "/mobile/explore", label: "Explore", Icon: Search },
  { href: "/mobile/chat", label: "Chat", Icon: MessageCircle },
  { href: "/mobile/nearby", label: "Nearby", Icon: MapPin },
  { href: "/mobile/notifications", label: "Alerts", Icon: Bell },
  { href: "/mobile/profile", label: "Profile", Icon: User },
  { href: "/mobile/sos", label: "SOS", Icon: ShieldAlert },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="safe-b border-t border-slate-200 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto max-w-md px-2 py-2 grid grid-cols-7 gap-1">
        {items.map(({ href, label, Icon }) => {
          const active =
            pathname === href ||
            (href === "/mobile" && (pathname === "/mobile" || pathname === "/mobile/"));

          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className={[
                "flex flex-col items-center justify-center rounded-2xl py-2 transition",
                active ? "bg-slate-100" : "hover:bg-slate-50",
              ].join(" ")}
            >
              <Icon
                size={20}
                className={active ? "text-blue-600" : "text-slate-500"}
              />
              <span
                className={[
                  "mt-1 text-[10px] leading-none",
                  active ? "text-blue-600 font-semibold" : "text-slate-500",
                ].join(" ")}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
