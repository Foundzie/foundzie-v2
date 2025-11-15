"use client";

// src/app/admin/chat/page.tsx

import { useEffect, useState, FormEvent } from "react";
import type { ChatMessage } from "../../data/chat";
import mockUsers, { AdminUser } from "../../data/users";

type ConversationUser = {
  id: string;
  name: string;
  roomId: string;
  subtitle: string;
};

function buildConversations(): ConversationUser[] {
  return mockUsers.map((u) => ({
    id: u.id,
    name: u.name,
    roomId: u.roomId,
    subtitle: u.interest || u.source || "",
  }));
}

export default function AdminChatPage() {
  const conversations = buildConversations();

  // pick first user as default
  const initialRoomId = conversations[0]?.roomId ?? "default";
  const initialUserId = conversations[0]?.id ?? null;

  const [selectedRoomId, setSelectedRoomId] = useState<string>(initialRoomId);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    initialUserId
  );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- NEW: visitor profile state ---
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  /* --------------------- Load chat messages --------------------- */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/chat/${selectedRoomId}?t=${Date.now()}`, {
          cache: "no-store",
        });

        const data = await res.json().catch(() => ({} as any));

        if (!res.ok) {
          throw new Error((data && data.message) || "Failed to load messages");
        }

        if (!cancelled && Array.isArray(data.items)) {
          setMessages(data.items as ChatMessage[]);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load chat messages (admin):", err);
          setError("Could not load chat history.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    // poll every 5 seconds
    const id = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [selectedRoomId]);

  /* --------------------- Load visitor profile --------------------- */
  useEffect(() => {
    if (!selectedUserId) {
      setSelectedUser(null);
      return;
    }

    let cancelled = false;

    async function loadProfile() {
      try {
        setProfileLoading(true);
        setProfileError(null);

        const res = await fetch(`/api/users/${selectedUserId}`);
        const data = await res.json().catch(() => ({} as any));

        if (!res.ok || !data.item) {
          throw new Error((data && data.message) || "Failed to load user");
        }

        if (!cancelled) {
          setSelectedUser(data.item as AdminUser);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load user profile:", err);
          setProfileError("Could not load user details.");
        }
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [selectedUserId]);

  /* --------------------- Send reply --------------------- */
  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setError(null);

    const tempId = `admin-temp-${Date.now()}`;
    const tempMessage: ChatMessage = {
      id: tempId,
      sender: "concierge",
      text,
      createdAt: new Date().toISOString(),
      attachmentName: null,
      attachmentKind: null,
    };

    // optimistic add
    setMessages((prev) => [...prev, tempMessage]);
    setInput("");

    try {
      const res = await fetch(`/api/chat/${selectedRoomId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          sender: "concierge",
        }),
      });

      const data = await res.json().catch(() => ({} as any));

      if (!res.ok || !data.item) {
        throw new Error((data && data.message) || "Admin send failed");
      }

      // replace temp with real message
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        return [...withoutTemp, data.item as ChatMessage];
      });
    } catch (err) {
      console.error("Admin chat send error:", err);
      setError("Could not send reply. Please try again.");

      // rollback optimistic message
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  const currentUser =
    conversations.find((c) => c.id === selectedUserId) ??
    conversations.find((c) => c.roomId === selectedRoomId) ??
    conversations[0] ??
    null;

  return (
    <main style={{ padding: "16px 0" }}>
      <div
        style={{
          maxWidth: "960px",
          margin: "0 auto",
          padding: "0 16px",
          display: "flex",
          gap: "16px",
          minHeight: "480px",
        }}
      >
        {/* LEFT: Conversation list */}
        <aside
          style={{
            width: "260px",
            minHeight: "340px",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            background: "white",
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <h2
            style={{
              fontSize: "14px",
              fontWeight: 600,
              marginBottom: "4px",
              color: "#1f2933",
            }}
          >
            Conversations
          </h2>

          {conversations.length === 0 && (
            <p style={{ fontSize: "12px", color: "#6b7280" }}>
              No conversations yet. When users send messages from the mobile
              app, they will appear here.
            </p>
          )}

          {conversations.map((c) => {
            const isActive = c.roomId === selectedRoomId;

            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setSelectedRoomId(c.roomId);
                  setSelectedUserId(c.id);
                }}
                style={{
                  textAlign: "left",
                  borderRadius: "9999px",
                  border: isActive
                    ? "2px solid #f97316"
                    : "1px solid #e5e7eb",
                  padding: "6px 8px",
                  background: isActive ? "#fef3c7" : "white",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#111827",
                  }}
                >
                  {c.name}
                </div>
                {c.subtitle && (
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#6b7280",
                      marginTop: "2px",
                    }}
                  >
                    {c.subtitle}
                  </div>
                )}
              </button>
            );
          })}
        </aside>

        {/* RIGHT: Chat + Visitor profile */}
        <section
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "row",
            gap: "12px",
          }}
        >
          {/* Chat column */}
          <div
            style={{
              flex: 2,
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              background: "white",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              minHeight: "340px",
            }}
          >
            <header style={{ marginBottom: "8px" }}>
              <h1 style={{ fontSize: "18px", fontWeight: 600 }}>Chat inbox</h1>
              <p style={{ fontSize: "12px", color: "#6b7280" }}>
                {currentUser
                  ? `Reading conversation for ${currentUser.name}. Replies you send here will appear in the user's chat.`
                  : "Select a conversation to view and reply."}
              </p>
            </header>

            <div
              style={{
                flex: 1,
                overflow: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                padding: "8px 0",
              }}
            >
              {loading && (
                <p style={{ fontSize: "12px", color: "#9ca3af" }}>
                  Loading conversation…
                </p>
              )}

              {!loading && messages.length === 0 && (
                <p style={{ fontSize: "12px", color: "#9ca3af" }}>
                  No chat messages yet for this user.
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
                        borderRadius: "9999px",
                        padding: "8px 12px",
                        fontSize: "12px",
                        background: isUser ? "#e5e7eb" : "#9333ea",
                        color: isUser ? "#111827" : "white",
                      }}
                    >
                      {/* sender label */}
                      <div
                        style={{
                          fontSize: "10px",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          marginBottom: "2px",
                          color: isUser ? "#64748b" : "#e9d5ff",
                        }}
                      >
                        {isUser ? "Visitor" : "Concierge"}
                      </div>

                      {/* attachment chip */}
                      {msg.attachmentName && (
                        <div
                          style={{
                            fontSize: "10px",
                            marginTop: "2px",
                            marginBottom: "2px",
                            opacity: 0.85,
                          }}
                        >
                          📎 {msg.attachmentName}
                        </div>
                      )}

                      <div
                        style={{
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        {msg.text || (msg.attachmentName ? "(attachment)" : "")}
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

            {error && (
              <p
                style={{
                  fontSize: "11px",
                  color: "#f87171",
                  marginTop: "4px",
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
                  borderRadius: "9999px",
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
                  borderRadius: "9999px",
                  padding: "8px 14px",
                  fontSize: "12px",
                  fontWeight: 500,
                  background: "#f97316",
                  color: "white",
                  opacity: sending || !input.trim() ? 0.6 : 1,
                  cursor: sending || !input.trim() ? "not-allowed" : "pointer",
                  border: "none",
                }}
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </form>
          </div>

          {/* Visitor profile column */}
          <aside
            style={{
              flex: 1,
              minWidth: "260px",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              background: "white",
              padding: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <h2
              style={{
                fontSize: "14px",
                fontWeight: 600,
                marginBottom: "4px",
                color: "#1f2933",
              }}
            >
              Visitor profile
            </h2>

            {profileLoading && (
              <p style={{ fontSize: "12px", color: "#9ca3af" }}>
                Loading profile…
              </p>
            )}

            {profileError && (
              <p style={{ fontSize: "12px", color: "#f87171" }}>
                {profileError}
              </p>
            )}

            {!profileLoading && !selectedUser && !profileError && (
              <p style={{ fontSize: "12px", color: "#6b7280" }}>
                Select a conversation to see visitor details.
              </p>
            )}

            {selectedUser && (
              <div
                style={{
                  fontSize: "12px",
                  color: "#111827",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <div style={{ fontWeight: 600 }}>{selectedUser.name}</div>
                <div style={{ color: "#6b7280" }}>
                  {selectedUser.email || "no-email@example.com"}
                </div>

                <div style={{ marginTop: "4px" }}>
                  <strong>Role:</strong> {selectedUser.role}
                </div>
                <div>
                  <strong>Status:</strong> {selectedUser.status}
                </div>
                <div>
                  <strong>Joined:</strong> {selectedUser.joined}
                </div>
                <div>
                  <strong>Source:</strong>{" "}
                  {selectedUser.source || "unknown"}
                </div>
                <div>
                  <strong>Interest:</strong>{" "}
                  {selectedUser.interest || "—"}
                </div>
                <div>
                  <strong>Room ID:</strong> {selectedUser.roomId}
                </div>

                <div>
                  <strong>Tags:</strong>{" "}
                  {selectedUser.tags && selectedUser.tags.length > 0
                    ? selectedUser.tags.join(", ")
                    : "none"}
                </div>

                <div style={{ marginTop: "4px" }}>
                  <strong>Concierge status:</strong>{" "}
                  {selectedUser.conciergeStatus}
                </div>
                <div>
                  <strong>Concierge note:</strong>{" "}
                  {selectedUser.conciergeNote || "—"}
                </div>
              </div>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}
