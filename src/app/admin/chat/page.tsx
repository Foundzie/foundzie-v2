// src/app/admin/chat/page.tsx

"use client";

// src/app/admin/chat/page.tsx
import { useEffect, useState, FormEvent } from "react";
import type { ChatMessage } from "@/app/data/chat";

type ChatRoomSummary = {
  id: string;
  lastMessage?: ChatMessage;
  lastAt?: string;
  lastSender?: "user" | "concierge";
};

export default function AdminChatPage() {
  const [rooms, setRooms] = useState<ChatRoomSummary[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- load rooms ----
  const loadRooms = async () => {
    try {
      const res = await fetch(`/api/chat?t=${Date.now()}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({} as any));
      if (Array.isArray(data.rooms)) {
        setRooms(data.rooms as ChatRoomSummary[]);

        if (!activeRoomId && data.rooms.length > 0) {
          setActiveRoomId(data.rooms[0].id as string);
        }
      }
    } catch (err) {
      console.error("Failed to load chat rooms:", err);
    }
  };

  // ---- load messages for current room ----
  const loadMessages = async (roomId: string) => {
    if (!roomId) return;

    try {
      if (messages.length === 0) setLoading(true);

      const res = await fetch(`/api/chat/${roomId}?t=${Date.now()}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({} as any));
      if (Array.isArray(data.items)) {
        setMessages(data.items as ChatMessage[]);
      }
    } catch (err) {
      console.error("Failed to load chat messages (admin):", err);
      setError("Could not load chat history.");
    } finally {
      setLoading(false);
    }
  };

  // Initial: load rooms
  useEffect(() => {
    loadRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Whenever activeRoomId changes, load that room's messages
  useEffect(() => {
    if (activeRoomId) {
      loadMessages(activeRoomId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoomId]);

  // Poll every 5 seconds (rooms + messages for active room)
  useEffect(() => {
    const id = setInterval(() => {
      loadRooms();
      if (activeRoomId) {
        loadMessages(activeRoomId);
      }
    }, 5000);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoomId]);

  const activeRoomLabel = (id: string | null) =>
    !id ? "No room selected" : id === "demo-visitor-1" ? "Demo visitor" : id;

  // Admin sends reply
  async function handleSend(e: FormEvent) {
    e.preventDefault();

    const roomId = activeRoomId;
    if (!roomId) return;

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
      attachmentName: null,
      attachmentKind: null,
    };

    // optimistic add
    setMessages((prev) => [...prev, adminMessage]);
    setInput("");

    try {
      const res = await fetch(`/api/chat/${roomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, sender: "concierge" }),
      });
      const data = await res.json().catch(() => ({} as any));

      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Admin send failed");
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
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "0 16px",
          display: "flex",
          gap: "16px",
        }}
      >
        {/* LEFT: room list */}
        <aside
          style={{
            width: "260px",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            padding: "16px",
            minHeight: "340px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            background: "#ffffff",
          }}
        >
          <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "4px" }}>
            Conversations
          </h2>
          <p style={{ fontSize: "11px", color: "#64748b", marginBottom: "8px" }}>
            One room per visitor. Select a room to view and reply.
          </p>

          {rooms.length === 0 && (
            <p style={{ fontSize: "12px", color: "#94a3b8" }}>
              No conversations yet.
            </p>
          )}

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              flex: 1,
              overflowY: "auto",
            }}
          >
            {rooms.map((room) => {
              const isActive = room.id === activeRoomId;
              const previewText =
                room.lastMessage?.text ||
                room.lastMessage?.attachmentName ||
                "No messages yet";

              return (
                <button
                  key={room.id}
                  onClick={() => setActiveRoomId(room.id)}
                  style={{
                    textAlign: "left",
                    borderRadius: "8px",
                    border: isActive ? "1px solid #a855f7" : "1px solid #e2e8f0",
                    padding: "8px 10px",
                    background: isActive ? "#f5f3ff" : "#ffffff",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      marginBottom: "2px",
                      color: "#0f172a",
                    }}
                  >
                    {activeRoomLabel(room.id)}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#64748b",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {previewText}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* RIGHT: chat panel */}
        <section style={{ flex: 1 }}>
          <header style={{ marginBottom: "16px" }}>
            <h1
              style={{
                fontSize: "20px",
                fontWeight: 600,
                color: "#0f172a",
              }}
            >
              Chat inbox
            </h1>
            <p style={{ fontSize: "12px", color: "#64748b" }}>
              Reading conversation for{" "}
              <span style={{ fontWeight: 600 }}>
                {activeRoomLabel(activeRoomId)}
              </span>
              . Replies you send here will appear in the user&apos;s chat.
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
            {/* messages list */}
            <div
              style={{
                flex: 1,
                overflow: "auto",
                padding: "8px 0",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {loading && (
                <p style={{ fontSize: "12px", color: "#94a3b8" }}>
                  Loading conversation...
                </p>
              )}

              {!loading && !activeRoomId && (
                <p style={{ fontSize: "12px", color: "#94a3b8" }}>
                  Select a room on the left to start chatting.
                </p>
              )}

              {!loading && activeRoomId && messages.length === 0 && (
                <p style={{ fontSize: "12px", color: "#94a3b8" }}>
                  No chat messages yet for this room.
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
                          color: isUser ? "#64748b" : "#e9d5ff",
                        }}
                      >
                        {isUser ? "User" : "Concierge"}
                      </div>

                      {/* attachment chip */}
                      {msg.attachmentName && (
                        <div
                          style={{
                            fontSize: "10px",
                            marginBottom: "2px",
                            opacity: 0.85,
                          }}
                        >
                          {msg.attachmentName}
                        </div>
                      )}

                      <div
                        style={{
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        {msg.text ||
                          (msg.attachmentName ? "(attachment)" : "")}
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
                  fontSize: "11px",
                  color: "#ef4444",
                  marginTop: "4px",
                }}
              >
                {error}
              </p>
            )}

            {/* reply box */}
            <form onSubmit={handleSend} style={{ marginTop: "8px" }}>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  alignItems: "center",
                }}
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={!activeRoomId}
                  placeholder={
                    activeRoomId
                      ? "Type a reply to the visitor..."
                      : "Select a room to reply..."
                  }
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
                  disabled={
                    sending || !input.trim() || !activeRoomId
                  }
                  style={{
                    borderRadius: "9999px",
                    padding: "8px 14px",
                    fontSize: "12px",
                    fontWeight: 500,
                    background: "#f97316",
                    color: "white",
                    opacity: sending || !input.trim() || !activeRoomId ? 0.6 : 1,
                    cursor:
                      sending || !input.trim() || !activeRoomId
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {sending ? "Sending..." : "Send"}
                </button>
              </div>
            </form>
          </section>
        </section>
      </div>
    </main>
  );
}
