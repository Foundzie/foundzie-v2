import BottomNav from "../components/BottomNav";

export default function MobileHome() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f3f4f6",
        paddingBottom: "56px", // space for bottom nav
      }}
    >
      {/* Top bar */}
      <div
        style={{
          background: "#fff",
          padding: "16px",
          borderBottom: "1px solid #eee",
        }}
      >
        <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#4c1d95" }}>
          Foundzie
        </h1>
        <p style={{ marginTop: "4px", color: "#6b7280", fontSize: "13px" }}>
          What’s happening near you
        </p>
      </div>

      {/* Content */}
      <div style={{ padding: "16px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>
          Nearby places
        </h2>

        {/* fake cards for now */}
        <div
          style={{
            display: "grid",
            gap: "12px",
          }}
        >
          {["Coffee House", "City Park", "Tech Museum"].map((name, i) => (
            <div
              key={i}
              style={{
                background: "#fff",
                borderRadius: "12px",
                padding: "12px 14px",
                boxShadow: "0 1px 2px rgba(15,23,42,0.05)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "4px",
                }}
              >
                <p style={{ fontWeight: 600 }}>{name}</p>
                <span
                    style={{
                      background: "#eef2ff",
                      color: "#4c1d95",
                      fontSize: "11px",
                      padding: "3px 8px",
                      borderRadius: "9999px",
                    }}
                >
                  0.{i + 3} mi
                </span>
              </div>
              <p style={{ fontSize: "13px", color: "#6b7280" }}>
                Suggested for you
              </p>
            </div>
          ))}
        </div>
      </div>

      <BottomNav />
    </main>
  );
}