// src/app/admin/trips/page.tsx
import { listTrips } from "@/app/api/trips/store";

export const dynamic = "force-dynamic";

export default async function AdminTripsPage() {
  const trips = await listTrips();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: "12px",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: "#111827",
              marginBottom: "4px",
            }}
          >
            Saved trip plans
          </h1>
          <p style={{ fontSize: "13px", color: "#6b7280" }}>
            Every time a guest taps <strong>“Save plan”</strong> in chat,
            their itinerary lands here.
          </p>
        </div>

        <div
          style={{
            padding: "4px 10px",
            borderRadius: "999px",
            background: "#eff6ff",
            color: "#1d4ed8",
            fontSize: "12px",
            border: "1px solid #bfdbfe",
          }}
        >
          {trips.length === 1
            ? "1 saved plan"
            : `${trips.length} saved plans`}
        </div>
      </header>

      {trips.length === 0 ? (
        <EmptyState />
      ) : (
        <TripsTable trips={trips} />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        marginTop: "12px",
        padding: "24px",
        borderRadius: "12px",
        border: "1px dashed #e5e7eb",
        background: "#f9fafb",
        textAlign: "center",
      }}
    >
      <p
        style={{
          fontSize: "14px",
          color: "#4b5563",
          marginBottom: "4px",
          fontWeight: 500,
        }}
      >
        No saved trips yet.
      </p>
      <p style={{ fontSize: "13px", color: "#6b7280" }}>
        Ask a user to tap <strong>“Save plan”</strong> under one of their trip
        itineraries in mobile chat to populate this list.
      </p>
    </div>
  );
}

type TripPlan = Awaited<ReturnType<typeof listTrips>>[number];

function TripsTable({ trips }: { trips: TripPlan[] }) {
  return (
    <div
      style={{
        marginTop: "8px",
        borderRadius: "12px",
        border: "1px solid #e5e7eb",
        overflow: "hidden",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "13px",
        }}
      >
        <thead
          style={{
            background: "#f9fafb",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <tr>
            <Th>Saved</Th>
            <Th>Room / Visitor</Th>
            <Th>Preview</Th>
            <Th style={{ width: "120px", textAlign: "right" }}>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {trips.map((trip, index) => (
            <tr
              key={trip.id}
              style={{
                background: index % 2 === 0 ? "#ffffff" : "#f9fafb",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <Td>
                <span style={{ display: "block" }}>
                  {formatDate(trip.savedAt)}
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: "11px",
                    color: "#9ca3af",
                  }}
                >
                  {formatTime(trip.savedAt)}
                </span>
              </Td>
              <Td>
                <code
                  style={{
                    fontSize: "11px",
                    background: "#f3f4f6",
                    padding: "2px 6px",
                    borderRadius: "999px",
                  }}
                >
                  {trip.roomId}
                </code>
                {trip.userId && (
                  <div
                    style={{
                      marginTop: "3px",
                      fontSize: "11px",
                      color: "#6b7280",
                    }}
                  >
                    User:{" "}
                    <span style={{ fontWeight: 500 }}>{trip.userId}</span>
                  </div>
                )}
              </Td>
              <Td>
                <div
                  style={{
                    maxWidth: "480px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    color: "#374151",
                  }}
                  title={trip.text}
                >
                  {summariseTrip(trip.text)}
                </div>
              </Td>
              <Td style={{ textAlign: "right" }}>
                <a
                  href={`/admin/chat?roomId=${encodeURIComponent(
                    trip.roomId
                  )}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "6px 10px",
                    fontSize: "12px",
                    borderRadius: "999px",
                    border: "1px solid #e5e7eb",
                    background: "#ffffff",
                    color: "#2563eb",
                    textDecoration: "none",
                  }}
                >
                  Open chat
                </a>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "10px 12px",
        fontWeight: 600,
        fontSize: "12px",
        color: "#6b7280",
        ...style,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <td
      style={{
        padding: "10px 12px",
        verticalAlign: "top",
        ...style,
      }}
    >
      {children}
    </td>
  );
}

function summariseTrip(text: string): string {
  // Remove the marker and newlines, show a compact preview
  const cleaned = text.replace(/^TRIP_PLAN_BEGIN\s*/i, "").trim();
  const singleLine = cleaned.replace(/\s+/g, " ");
  return singleLine.length > 140
    ? singleLine.slice(0, 140) + "…"
    : singleLine || "(empty plan)";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}
