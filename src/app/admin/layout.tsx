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
        background: "#faf4f6", // light grey background
        color: "#111827", // darker text for visibility
      }}
    >
      <header
        style={{
          background: "white",
          borderBottom: "1px solid #e5e7eb",
          height: "56px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        {/* Left side: title + simple nav */}
        <div>
          <div
            style={{
              fontWeight: 700,
              color: "#f44e65",
              fontSize: "18px",
            }}
          >
            Foundzie Admin
          </div>

          <nav
            style={{
              display: "flex",
              gap: "10px",
              marginTop: "4px",
              fontSize: "13px",
            }}
          >
            <Link href="/admin" style={{ color: "#6b7280" }}>
              Dashboard
            </Link>
            <span style={{ color: "#9ca3af" }}>•</span>

            <Link href="/admin/users" style={{ color: "#6b7280" }}>
              Users
            </Link>
            <span style={{ color: "#9ca3af" }}>•</span>

            <Link href="/admin/notifications" style={{ color: "#6b7280" }}>
              Notifications
            </Link>
            <span style={{ color: "#9ca3af" }}>•</span>

            {/* NEW: SOS link */}
            <Link href="/admin/sos" style={{ color: "#6b7280" }}>
              SOS
            </Link>
            <span style={{ color: "#9ca3af" }}>•</span>

            {/* Chat stays highlighted as you had it */}
            <Link
              href="/admin/chat"
              style={{ color: "#f44e65", fontWeight: 600 }}
            >
              Chat
            </Link>
          </nav>
        </div>

        {/* Right side: fake admin avatar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            color: "#6b7280",
            fontSize: "14px",
          }}
        >
          <span>Admin</span>
          <img
            src="https://ui-avatars.com/api/?name=Admin&background=f44e65&color=fff"
            alt="Admin Avatar"
            style={{ width: "32px", height: "32px", borderRadius: "50%" }}
          />
        </div>
      </header>

      <main
        style={{
          padding: "24px",
          background: "white",
          maxWidth: "1200px",
          margin: "20px auto",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        {children}
      </main>
    </div>
  );
}
