// src/app/admin/layout.tsx
import "../globals.css";
import Link from "next/link";

export const metadata = {
  title: "Foundzie Admin",
  description: "Control center for Foundzie global concierge system",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f3f4f6", // light grey background
        color: "#111827",
      }}
    >
      {/* Top bar */}
      <header
        style={{
          background: "white",
          borderBottom: "1px solid #e5e7eb",
          height: "64px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          position: "sticky",
          top: 0,
          zIndex: 100,
          boxShadow: "0 1px 2px rgba(15,23,42,0.05)",
        }}
      >
        {/* Left side: logo + subtitle */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div
            style={{
              fontWeight: 800,
              color: "#f97373",
              fontSize: "20px",
              letterSpacing: "0.04em",
            }}
          >
            Foundzie Admin
          </div>
          <span
            style={{
              fontSize: "12px",
              color: "#9ca3af",
            }}
          >
            Concierge control center — calls, trips, SOS & more
          </span>
        </div>

        {/* Right side: admin chip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            color: "#6b7280",
            fontSize: "14px",
          }}
          title="Signed in as Admin"
        >
          <span>Admin</span>
          <img
            src="https://ui-avatars.com/api/?name=Admin&background=f97373&color=ffffff"
            alt="Admin Avatar"
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "999px",
              boxShadow: "0 0 0 2px #fee2e2",
            }}
          />
        </div>
      </header>

      {/* Secondary nav bar */}
      <nav
        style={{
          position: "sticky",
          top: 64,
          zIndex: 90,
          background: "#f3f4f6",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "10px 24px 12px",
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          {/* Each item is a pill-style link */}
          <NavPill href="/admin" label="Dashboard" />
          <NavPill href="/admin/users" label="Users" />
          <NavPill href="/admin/chat" label="Chat" emphasis />
          <NavPill href="/admin/calls" label="Calls" />
          <NavPill href="/admin/notifications" label="Notifications" />
          <NavPill href="/admin/sos" label="SOS" />
          <NavPill href="/admin/trips" label="Trips" />
        </div>
      </nav>

      {/* Main content card */}
      <main
        style={{
          padding: "24px",
          maxWidth: "1200px",
          margin: "20px auto 32px",
        }}
      >
        <section
          style={{
            background: "white",
            borderRadius: "16px",
            border: "1px solid #e5e7eb",
            boxShadow: "0 4px 12px rgba(15,23,42,0.04)",
            padding: "20px 20px 24px",
          }}
        >
          {children}
        </section>
      </main>
    </div>
  );
}

/**
 * Simple pill-style nav link component for the admin header.
 * This is kept in the same file for simplicity.
 */
function NavPill({
  href,
  label,
  emphasis = false,
}: {
  href: string;
  label: string;
  emphasis?: boolean;
}) {
  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 14px",
    borderRadius: "999px",
    fontSize: "13px",
    textDecoration: "none",
    border: "1px solid transparent",
    transition: "background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease",
  };

  const normal: React.CSSProperties = {
    ...baseStyle,
    background: "#ffffff",
    color: "#4b5563",
    borderColor: "#e5e7eb",
  };

  const highlighted: React.CSSProperties = {
    ...baseStyle,
    background: "#fef2f2",
    color: "#b91c1c",
    borderColor: "#fecaca",
    fontWeight: 600,
  };

  return (
    <Link href={href} style={emphasis ? highlighted : normal}>
      {label}
    </Link>
  );
}
