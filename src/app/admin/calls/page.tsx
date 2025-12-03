// src/app/admin/calls/page.tsx
import Link from "next/link";
import { listCallLogs } from "@/app/api/calls/store";

export const dynamic = "force-dynamic";

export default async function AdminCallLogsPage() {
  const logs = await listCallLogs(50);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "8px",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "22px",
              fontWeight: 700,
              marginBottom: "4px",
            }}
          >
            Call logs
          </h1>
          <p style={{ fontSize: "13px", color: "#6b7280" }}>
            Recent outbound calls from Foundzie concierge to users.
          </p>
        </div>

        <Link
          href="/admin"
          style={{
            fontSize: "13px",
            color: "#f44e65",
            textDecoration: "none",
          }}
        >
          ← Back to dashboard
        </Link>
      </div>

      {logs.length === 0 ? (
        <p style={{ fontSize: "14px", color: "#6b7280" }}>
          No calls have been logged yet. Use &quot;Call [phone]&quot; from a
          user profile and they will appear here.
        </p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "13px",
          }}
        >
          <thead>
            <tr
              style={{
                textAlign: "left",
                borderBottom: "1px solid #e5e7eb",
                background: "#faf5ff",
              }}
            >
              <th style={{ padding: "8px" }}>Time</th>
              <th style={{ padding: "8px" }}>User</th>
              <th style={{ padding: "8px" }}>Phone</th>
              <th style={{ padding: "8px" }}>Direction</th>
              <th style={{ padding: "8px" }}>Note</th>
              <th style={{ padding: "8px" }}>Call ID</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ padding: "8px", whiteSpace: "nowrap" }}>
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td style={{ padding: "8px" }}>
                  {log.userName || "Unknown user"}
                  {log.userId ? (
                    <>
                      <br />
                      <span style={{ color: "#9ca3af" }}>
                        ID: {log.userId}
                      </span>
                    </>
                  ) : null}
                </td>
                <td style={{ padding: "8px" }}>{log.phone}</td>
                <td
                  style={{
                    padding: "8px",
                    textTransform: "capitalize",
                  }}
                >
                  {log.direction}
                </td>
                <td style={{ padding: "8px" }}>
                  {log.note || (
                    <span style={{ color: "#9ca3af" }}>No note</span>
                  )}
                </td>
                <td
                  style={{
                    padding: "8px",
                    fontFamily: "monospace",
                    fontSize: "12px",
                    color: "#6b7280",
                  }}
                >
                  {log.id}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
