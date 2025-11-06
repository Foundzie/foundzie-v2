// src/app/admin/page.tsx
import Link from "next/link";

export default function AdminHome() {
  const cards = [
    {
      title: "Places",
      description: "View / approve / edit places.",
      href: "/admin/places",
    },
    {
      title: "Users",
      description: "Manage explorers and responders.",
      href: "/admin/users",
    },
    {
      title: "Notifications",
      description: "Send push / in-app alerts.",
      href: "/admin/notifications",
    },
  ];

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      <h1 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "8px" }}>
        Internal tools for managing places, users and notifications.
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
        }}
      >
        {cards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            style={{
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "10px",
              padding: "16px",
              textDecoration: "none",
              color: "#111827",
            }}
          >
            <h2 style={{ fontWeight: 600, marginBottom: "4px" }}>
              {card.title}
            </h2>
            <p style={{ fontSize: "14px", color: "#6b7280" }}>
              {card.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}