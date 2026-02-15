"use client";

import { useState } from "react";

export default function AdminLogin() {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onLogin() {
    setErr(null);
    const t = token.trim();
    if (!t) {
      setErr("Enter your admin token.");
      return;
    }

    try {
      setBusy(true);
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: t }),
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || `Login failed (${res.status})`);
      }

      // ✅ cookie set (httpOnly) — reload into admin
      window.location.reload();
    } catch (e: any) {
      setErr(e?.message || "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <label style={{ display: "block", fontSize: 12, color: "#cbd5e1" }}>
        Admin Token
      </label>
      <input
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="Paste ADMIN_TOKEN"
        style={{
          width: "100%",
          marginTop: 6,
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid rgba(148,163,184,0.25)",
          background: "rgba(2,6,23,0.5)",
          color: "#e5e7eb",
          outline: "none",
        }}
      />

      <button
        onClick={onLogin}
        disabled={busy}
        style={{
          width: "100%",
          marginTop: 10,
          padding: "10px 12px",
          borderRadius: 12,
          background: busy ? "rgba(251,113,133,0.5)" : "#fb7185",
          color: "#111827",
          fontWeight: 800,
          border: "none",
          cursor: busy ? "not-allowed" : "pointer",
        }}
      >
        {busy ? "Signing in..." : "Sign in"}
      </button>

      {err && (
        <div style={{ marginTop: 10, color: "#fca5a5", fontSize: 12 }}>
          {err}
        </div>
      )}
    </div>
  );
}
