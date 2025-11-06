import "../globals.css";

export const metadata = {
  title: "Foundzie Admin",
  description: "Control center for Foundzie global concierge system",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f3f4f6", // light grey background
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
        <div style={{ fontWeight: 700, color: "#4f46e5", fontSize: "18px" }}>
          Foundzie Admin
        </div>
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
            src="https://ui-avatars.com/api/?name=Admin&background=4f46e5&color=fff"
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