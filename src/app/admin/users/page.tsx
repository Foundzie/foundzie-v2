// src/app/admin/users/page.tsx
export default function AdminUsersPage() {
  const users = [
    { name: "Kashif", role: "Explorer", status: "Active" },
    { name: "Ops Supervisor", role: "Responder", status: "Active" },
    { name: "Test User", role: "Explorer", status: "Suspended" },
  ];

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      <h1 style={{ fontSize: "20px", fontWeight: 600 }}>Users</h1>
      <p style={{ color: "#6b7280" }}>
        Later this will be filtered, searchable, and backed by the database.
      </p>

      <div
        style={{
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: "10px",
        }}
      >
        {users.map((user) => (
          <div
            key={user.name}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "12px 16px",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <div>
              <div style={{ fontWeight: 500 }}>{user.name}</div>
              <div style={{ fontSize: "13px", color: "#6b7280" }}>
                {user.role}
              </div>
            </div>
            <div
              style={{
                fontSize: "12px",
                background: user.status === "Active" ? "#dcfce7" : "#fee2e2",
                color: user.status === "Active" ? "#166534" : "#b91c1c",
                padding: "4px 10px",
                borderRadius: "9999px",
                height: "fit-content",
              }}
            >
              {user.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}