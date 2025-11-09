"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const NAV = [
    { href: "/mobile", label: "Home" },
    { href: "/mobile/explore", label: "Explore" },
    { href: "/mobile/notifications", label: "Alerts" },
    { href: "/mobile/profile", label: "Profile" },
    { href: "/mobile/sos", label: "SOS" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-white">
      <div className="flex-1 overflow-y-auto">{children}</div>

      <nav className="flex justify-around border-t border-slate-800 bg-slate-900 py-3">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={
              "text-xs " +
              (pathname === item.href
                ? "text-pink-500 font-semibold"
                : "text-slate-400")
            }
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}