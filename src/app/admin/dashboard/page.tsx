"use client";

import { useEffect, useState } from "react";

export default function Dashboard() {
  const [stats, setStats] = useState({
    usersOnline: 32,
    activeSessions: 12,
    sosAlerts: 0,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setStats({
        usersOnline: 32 + Math.floor(Math.random() * 4),
        activeSessions: 12 + Math.floor(Math.random() * 3),
        sosAlerts: Math.floor(Math.random() * 2),
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "16px" }}>
        Live Dashboard
      </h1>
      <p style={{ color: "#6b7280", marginBottom: "24px" }}>
        Real-time overview of system activity.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "16px",
        }}
      >
        <div style={cardStyle}>
          <h2 style={titleStyle}>Users Online</h2>
          <p style={valueStyle}>{stats.usersOnline}</p>
        </div>
        <div style={cardStyle}>
          <h2 style={titleStyle}>Active Sessions</h2>
          <p style={valueStyle}>{stats.activeSessions}</p>
        </div>
        <div style={cardStyle}>
          <h2 style={titleStyle}>SOS Alerts</h2>
          <p style={{ ...valueStyle, color: stats.sosAlerts > 0 ? "#dc2626" : "#16a34a" }}>
            {stats.sosAlerts > 0 ? `${stats.sosAlerts} Active` : "None"}
          </p>
        </div>
      </div>
    </div>
  );
}

const cardStyle = {
  background: "white",
  borderRadius: "12px",
  padding: "16px",
  border: "1px solid #e5e7eb",
  textAlign: "center",
};

const titleStyle = {
  fontSize: "14px",
  color: "#6b7280",
  marginBottom: "6px",
};

const valueStyle = {
  fontSize: "24px",
  fontWeight: 700,
  color: "#111827",
};