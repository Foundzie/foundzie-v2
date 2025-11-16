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

  // --- Visitor profile state (live user from API) ---
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // draft fields you can edit in the sidebar
  const [profileDraft, setProfileDraft] = useState<{
    interest: string;
    source: string;
    tagsText: string; // comma-separated tags
    conciergeStatus: string;
    conciergeNote: string;
  }>({
    interest: "",
    source: "",
    tagsText: "",
    conciergeStatus: "",
    conciergeNote: "",
  });

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaveMessage, setProfileSaveMessage] = useState<string | null>(
    null
  );

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
      setProfileDraft({
        interest: "",
        source: "",
        tagsText: "",
        conciergeStatus: "",
        conciergeNote: "",
      });
      setProfileSaveMessage(null);
      return;
    }

    let cancelled = false;

    async function loadProfile() {
      try {
        setProfileLoading(true);
        setProfileError(null);
        setProfileSaveMessage(null);

        const res = await fetch(`/api/users/${selectedUserId}`);
        const data = await res.json().catch(() => ({} as any));

        if (!res.ok || !data.item) {
          throw new Error((data && data.message) || "Failed to load user");
        }

        if (!cancelled) {
          const user = data.item as AdminUser;
          setSelectedUser(user);
          setProfileDraft({
            interest: user.interest ?? "",
            source: user.source ?? "",
            tagsText: (user.tags ?? []).join(", "),
              conciergeStatus: user.conciergeStatus ?? "open",

            conciergeNote: user.conciergeNote ?? "",
          });
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

  /* --------------------- Save visitor profile --------------------- */
  async function handleProfileSave(e: FormEvent) {
    e.preventDefault();
    if (!selectedUserId || !selectedUser || profileSaving) return;

    setProfileSaving(true);
    setProfileError(null);
    setProfileSaveMessage(null);

    const payload = {
      interest: profileDraft.interest.trim(),
      source: profileDraft.source.trim(),
      conciergeStatus:
        profileDraft.conciergeStatus || selectedUser.conciergeStatus,
      conciergeNote: profileDraft.conciergeNote,
      tags: profileDraft.tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };

    try {
      const res = await fetch(`/api/users/${selectedUserId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({} as any));

      if (!res.ok || !data.item) {
        throw new Error((data && data.message) || "Profile update failed");
      }

      const updated = data.item as AdminUser;
      setSelectedUser(updated);
      setProfileDraft({
        interest: updated.interest ?? "",
        source: updated.source ?? "",
        tagsText: (updated.tags ?? []).join(", "),
          conciergeStatus: updated.conciergeStatus ?? "open",

        conciergeNote: updated.conciergeNote ?? "",
      });
      setProfileSaveMessage("Profile saved.");
    } catch (err) {
      console.error("Failed to save visitor profile:", err);
      setProfileError("Could not save visitor profile.");
    } finally {
      setProfileSaving(false);
    }
  }

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
              <form
                onSubmit={handleProfileSave}
                style={{
                  fontSize: "12px",
                  color: "#111827",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                {/* read-only basics */}
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
                  <strong>Room ID:</strong> {selectedUser.roomId}
                </div>

                {/* editable fields */}
                <label style={{ marginTop: "4px" }}>
                  <div style={{ fontWeight: 600 }}>Interest</div>
                  <input
                    value={profileDraft.interest}
                    onChange={(e) =>
                      setProfileDraft((d) => ({
                        ...d,
                        interest: e.target.value,
                      }))
                    }
                    placeholder="e.g. Nightlife in Chicago"
                    style={{
                      width: "100%",
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                      padding: "4px 6px",
                      fontSize: "12px",
                    }}
                  />
                </label>

                <label>
                  <div style={{ fontWeight: 600 }}>Source</div>
                  <input
                    value={profileDraft.source}
                    onChange={(e) =>
                      setProfileDraft((d) => ({
                        ...d,
                        source: e.target.value,
                      }))
                    }
                    placeholder="e.g. mobile-concierge, web, ad campaign…"
                    style={{
                      width: "100%",
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                      padding: "4px 6px",
                      fontSize: "12px",
                    }}
                  />
                </label>

                <label>
                  <div style={{ fontWeight: 600 }}>Tags</div>
                  <input
                    value={profileDraft.tagsText}
                    onChange={(e) =>
                      setProfileDraft((d) => ({
                        ...d,
                        tagsText: e.target.value,
                      }))
                    }
                    placeholder="vip, chicago, nightlife"
                    style={{
                      width: "100%",
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                      padding: "4px 6px",
                      fontSize: "12px",
                    }}
                  />
                  <div style={{ fontSize: "10px", color: "#9ca3af" }}>
                    Comma-separated (no need to worry about spaces).
                  </div>
                </label>

                <label>
                  <div style={{ fontWeight: 600 }}>Concierge status</div>
                  <select
                    value={profileDraft.conciergeStatus}
                    onChange={(e) =>
                      setProfileDraft((d) => ({
                        ...d,
                        conciergeStatus: e.target.value,
                      }))
                    }
                    style={{
                      width: "100%",
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                      padding: "4px 6px",
                      fontSize: "12px",
                      background: "white",
                    }}
                  >
                    <option value="">Select status…</option>
                    <option value="open">Open</option>
                    <option value="in-progress">In progress</option>
                    <option value="done">Done</option>
                  </select>
                </label>

                <label>
                  <div style={{ fontWeight: 600 }}>Concierge note</div>
                  <textarea
                    value={profileDraft.conciergeNote}
                    onChange={(e) =>
                      setProfileDraft((d) => ({
                        ...d,
                        conciergeNote: e.target.value,
                      }))
                    }
                    rows={3}
                    placeholder="Internal notes for this guest…"
                    style={{
                      width: "100%",
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                      padding: "4px 6px",
                      fontSize: "12px",
                      resize: "vertical",
                    }}
                  />
                </label>

                {profileSaveMessage && (
                  <div
                    style={{ fontSize: "11px", color: "#16a34a", marginTop: 2 }}
                  >
                    {profileSaveMessage}
                  </div>
                )}

                {profileError && (
                  <div
                    style={{ fontSize: "11px", color: "#f97316", marginTop: 2 }}
                  >
                    {profileError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={profileSaving}
                  style={{
                    marginTop: "6px",
                    alignSelf: "flex-start",
                    borderRadius: "9999px",
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: 500,
                    background: "#4f46e5",
                    color: "white",
                    opacity: profileSaving ? 0.6 : 1,
                    cursor: profileSaving ? "not-allowed" : "pointer",
                    border: "none",
                  }}
                >
                  {profileSaving ? "Saving…" : "Save profile"}
                </button>
              </form>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}
