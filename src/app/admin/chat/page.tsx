// src/app/admin/chat/page.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import type { ChatMessage } from "../../data/chat";

export default function AdminChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ----- shared loader (initial + polling) -----
  const loadMessages = async () => {
    try {
      if (messages.length === 0) setLoading(true);

      const res = await fetch(`/api/chat?ts=${Date.now()}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({} as any));

      if (Array.isArray(data.items)) {
        setMessages(data.items as ChatMessage[]);
      }
    } catch (err) {
      console.error("Failed to load chat messages (admin)", err);
      setError("Could not load chat history.");
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll every 5 seconds
  useEffect(() => {
    const id = setInterval(() => {
      loadMessages();
    }, 5000);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- send reply from admin (concierge) -----
  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setError(null);

    const tempId = `admin-temp-${Date.now()}`;
    const adminMessage: ChatMessage = {
      id: tempId,
      sender: "concierge",
      text,
      createdAt: new Date().toISOString(),
    };

    // optimistic add
    setMessages((prev) => [...prev, adminMessage]);
    setInput("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, sender: "concierge" }),
      });

      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Send failed");
      }

      // replace temp with real saved message
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        const final: ChatMessage[] = [...withoutTemp];

        if (data.item) {
          final.push(data.item as ChatMessage);
        }
        return final;
      });
    } catch (err) {
      console.error("Admin chat send error", err);
      setError("Could not send reply. Please try again.");
      // rollback optimistic
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  return (
    <main style={{ padding: "16px 0" }}>
      <div
        style={{
          maxWidth: "960px",
          margin: "0 auto",
          padding: "0 16px",
        }}
      >
        <header style={{ marginBottom: "16px" }}>
          <h1 style={{ fontSize: "20px", fontWeight: 600 }}>Chat inbox</h1>
          <p style={{ fontSize: "12px", color: "#64748b" }}>
            Read recent conversations coming from the mobile chat. Replies you
            send here will appear in the user&apos;s chat.
          </p>
        </header>

        <section
          style={{
            background: "white",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            padding: "16px",
            minHeight: "340px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ marginBottom: "8px", fontSize: "12px", color: "#94a3b8" }}>
            {/* simple static filter labels for now */}
            <span>Filter&nbsp;</span>
            <span
              style={{
                padding: "2px 8px",
                borderRadius: "999px",
                background: "#f97316",
                color: "white",
                fontWeight: 500,
                fontSize: "11px",
              }}
            >
              All
            </span>
            <span style={{ marginLeft: "8px", fontSize: "11px" }}>Visitors</span>
            <span style={{ marginLeft: "8px", fontSize: "11px" }}>Concierge</span>
          </div>

          {/* messages */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "8px 0",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {loading && (
              <p style={{ fontSize: "12px", color: "#94a3b8" }}>
                Loading conversation…
              </p>
            )}

            {!loading && messages.length === 0 && (
              <p style={{ fontSize: "12px", color: "#94a3b8" }}>
                No chat messages yet. When users send messages from the mobile
                app, they will appear here.
              </p>
            )}

            {messages.map((msg) => {
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
                      borderRadius: "999px",
                      padding: "8px 12px",
                      fontSize: "12px",
                      background: isUser ? "#e2e8f0" : "#9333ea",
                      color: isUser ? "#0f172a" : "white",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "10px",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        marginBottom: "2px",
                        color: isUser ? "#64748b" : "#f9eaff",
                      }}
                    >
                      {isUser ? "User" : "Concierge"}
                    </div>
                    <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {msg.text}
                    </div>
                    <div
                      style={{
                        fontSize: "10px",
                        marginTop: "2px",
                        opacity: 0.8,
                        textAlign: "right",
                      }}
                    >
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* error */}
          {error && (
            <p
              style={{
                marginTop: "4px",
                marginBottom: "4px",
                fontSize: "11px",
                color: "#ef4444",
              }}
            >
              {error}
            </p>
          )}

          {/* reply box */}
          <form
            onSubmit={handleSend}
            style={{
              marginTop: "8px",
              display: "flex",
              gap: "8px",
              alignItems: "center",
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a reply to the visitor…"
              style={{
                flex: 1,
                borderRadius: "999px",
                border: "1px solid #cbd5f5",
                padding: "8px 12px",
                fontSize: "12px",
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              style={{
                borderRadius: "999px",
                padding: "8px 14px",
                fontSize: "12px",
                fontWeight: 500,
                background: "#f97316",
                color: "white",
                opacity: sending || !input.trim() ? 0.6 : 1,
                cursor:
                  sending || !input.trim() ? "not-allowed" : "pointer",
              }}
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
