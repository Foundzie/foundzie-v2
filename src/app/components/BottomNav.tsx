"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/mobile", label: "Home" },
  { href: "/mobile/explore", label: "Explore" },
  { href: "/mobile/notifications", label: "Alerts" },
  { href: "/mobile/profile", label: "Profile" },
  { href: "/mobile/sos", label: "SOS" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        display: "flex",
        background: "#fff",
        borderTop: "1px solid #eee",
        height: "56px",
        zIndex: 50,
      }}
    >
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              textDecoration: "none",
              color: active ? "#6d28d9" : "#555",
              fontWeight: active ? 600 : 400,
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}