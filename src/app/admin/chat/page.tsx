// src/app/admin/chat/page.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import type { ChatMessage } from "@/app/data/chat";

type Filter = "all" | "visitors" | "concierge";

export default function AdminChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  // Load all chat messages once
  useEffect(() => {
    async function loadMessages() {
      try {
        setLoading(true);
        const res = await fetch("/api/chat", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));

        if (Array.isArray(data.items)) {
          setMessages(data.items as ChatMessage[]);
        }
      } catch (err) {
        console.error("Failed to load chat messages in admin:", err);
        setError("Could not load chat history.");
      } finally {
        setLoading(false);
      }
    }

    loadMessages();
  }, []);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setError(null);

    // optimistic admin message
    const tempId = `admin-${Date.now()}`;
    const adminMessage: ChatMessage = {
      id: tempId,
      sender: "concierge",
      text,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, adminMessage]);
    setInput("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, sender: "concierge" }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "Failed to send reply");
      }

      // replace temp message with real one from backend
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        const final: ChatMessage[] = [...withoutTemp];

        if (data.item) {
          final.push(data.item as ChatMessage);
        }

        return final;
      });
    } catch (err) {
      console.error("Admin send error:", err);
      setError("Could not send reply. Please try again.");

      // rollback optimistic message and restore text in box
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  const filteredMessages = messages.filter((m) => {
    if (filter === "visitors") return m.sender === "user";
    if (filter === "concierge") return m.sender === "concierge";
    return true;
  });

  return (
    <div>
      <header
        style={{
          marginBottom: "16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 600 }}>Chat inbox</h1>
          <p style={{ fontSize: "13px", color: "#6b7280" }}>
            Read recent conversations coming from the mobile chat. Replies you
            send here will appear in the user&apos;s chat.
          </p>
        </div>

        <Link
          href="/admin"
          style={{ fontSize: "12px", color: "#7c3aed", textDecoration: "none" }}
        >
          ← Back to dashboard
        </Link>
      </header>

      {/* Filters */}
      <div style={{ marginBottom: "16px", fontSize: "13px" }}>
        <span style={{ marginRight: "8px" }}>Filter</span>
        {(
          [
            { id: "all", label: "All" },
            { id: "visitors", label: "Visitors" },
            { id: "concierge", label: "Concierge" },
          ] as { id: Filter; label: string }[]
        ).map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            style={{
              padding: "4px 10px",
              borderRadius: "999px",
              marginRight: "6px",
              border: "none",
              fontSize: "12px",
              cursor: "pointer",
              backgroundColor:
                filter === f.id ? "#7c3aed" : "rgba(124,58,237,0.06)",
              color: filter === f.id ? "white" : "#4b5563",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Chat thread */}
      <section
        style={{
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
          padding: "16px",
          minHeight: "260px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          background: "white",
        }}
      >
        {loading && (
          <p style={{ fontSize: "13px", color: "#6b7280" }}>
            Loading conversation…
          </p>
        )}

        {!loading && filteredMessages.length === 0 && (
          <p style={{ fontSize: "13px", color: "#6b7280" }}>
            No messages yet. Messages from the mobile chat will appear here.
          </p>
        )}

        {!loading &&
          filteredMessages.map((msg) => {
            const isUser = msg.sender === "user";
            return (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  justifyContent: isUser ? "flex-start" : "flex-end",
                }}
              >
                <div
                  style={{
                    maxWidth: "70%",
                    borderRadius: "16px",
                    padding: "8px 12px",
                    fontSize: "13px",
                    backgroundColor: isUser ? "#f3f4f6" : "#7c3aed",
                    color: isUser ? "#111827" : "white",
                  }}
                >
                  <p
                    style={{
                      fontSize: "10px",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: "2px",
                      color: isUser
                        ? "#6b7280"
                        : "rgba(249,250,251,0.8)",
                    }}
                  >
                    {isUser ? "Visitor" : "Concierge"}
                  </p>
                  <p style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {msg.text}
                  </p>
                  <p
                    style={{
                      marginTop: "4px",
                      fontSize: "10px",
                      color: isUser ? "#9ca3af" : "rgba(249,250,251,0.75)",
                      textAlign: "right",
                    }}
                  >
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })}
      </section>

      {/* Error */}
      {error && (
        <p
          style={{
            marginTop: "8px",
            fontSize: "12px",
            color: "#b91c1c",
          }}
        >
          {error}
        </p>
      )}

      {/* Reply box */}
      <form
        onSubmit={handleSend}
        style={{
          marginTop: "16px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a reply to the visitor…"
          style={{
            flex: 1,
            borderRadius: "999px",
            border: "1px solid #d1d5db",
            padding: "8px 12px",
            fontSize: "13px",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          style={{
            padding: "8px 14px",
            borderRadius: "999px",
            border: "none",
            fontSize: "13px",
            fontWeight: 500,
            cursor: sending || !input.trim() ? "not-allowed" : "pointer",
            backgroundColor: sending || !input.trim() ? "#d1d5db" : "#7c3aed",
            color: "white",
          }}
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
    </div>
  );
}
