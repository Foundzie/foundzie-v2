// src/app/admin/places/page.tsx
export default function AdminPlacesPage() {
  const samplePlaces = [
    { name: "Sunny Park", status: "Pending", city: "Austin" },
    { name: "Hilltop Cafe", status: "Approved", city: "Austin" },
    { name: "Night Market", status: "Flagged", city: "Dallas" },
  ];

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      <h1 style={{ fontSize: "20px", fontWeight: 600 }}>Places</h1>
      <p style={{ color: "#6b7280" }}>
        These are mock rows. Later we can connect to a real database.
      </p>

      <div
        style={{
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: "10px",
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#f3f4f6" }}>
            <tr>
              <th style={{ textAlign: "left", padding: "10px" }}>Name</th>
              <th style={{ textAlign: "left", padding: "10px" }}>City</th>
              <th style={{ textAlign: "left", padding: "10px" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {samplePlaces.map((place) => (
              <tr key={place.name} style={{ borderTop: "1px solid #e5e7eb" }}>
                <td style={{ padding: "10px" }}>{place.name}</td>
                <td style={{ padding: "10px" }}>{place.city}</td>
                <td style={{ padding: "10px" }}>{place.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}