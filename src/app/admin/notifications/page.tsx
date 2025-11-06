// src/app/admin/notifications/page.tsx
"use client";

import { useState } from "react";

export default function AdminNotificationsPage() {
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setPreview(message || "(empty message)");
  }

  return (
    <div style={{ display: "grid", gap: "16px", maxWidth: "520px" }}>
      <h1 style={{ fontSize: "20px", fontWeight: 600 }}>Notifications</h1>
      <p style={{ color: "#6b7280" }}>
        This is a mock screen for sending alerts to the mobile app.
      </p>

      <form
        onSubmit={handleSend}
        style={{
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: "10px",
          padding: "16px",
          display: "grid",
          gap: "12px",
        }}
      >
        <label style={{ fontWeight: 500 }}>Notification text</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          style={{
            border: "1px solid #d1d5db",
            borderRadius: "8px",
            padding: "8px",
            outline: "none",
          }}
          placeholder="E.g. New spot added near you!"
        ></textarea>

        <button
          type="submit"
          style={{
            background: "#4f46e5",
            color: "white",
            border: "none",
            borderRadius: "8px",
            padding: "8px 12px",
            fontWeight: 500,
            cursor: "pointer",
            width: "fit-content",
          }}
        >
          Send mock notification
        </button>
      </form>

      {preview && (
        <div
          style={{
            background: "#ecfdf3",
            border: "1px solid #bbf7d0",
            borderRadius: "10px",
            padding: "12px",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: "4px" }}>
            Preview (fake):
          </div>
          <div>{preview}</div>
        </div>
      )}
    </div>
  );
}