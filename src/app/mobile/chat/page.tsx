// src/app/mobile/chat/page.tsx

"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { ChatMessage } from "@/app/data/chat";

const VISITOR_ID_STORAGE_KEY = "foundzie_visitor_id";

function createVisitorId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `visitor-${crypto.randomUUID()}`;
  }
  // Fallback for environments without randomUUID
  return `visitor-${Date.now().toString(16)}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

export default function MobileChatPage() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Profile sharing (M2d)
  const [hasSharedProfile, setHasSharedProfile] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [interestDraft, setInterestDraft] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSavedMessage, setProfileSavedMessage] = useState<string | null>(
    null
  );

  // ---------------- Visitor identity (roomId) ----------------
  useEffect(() => {
    if (typeof window === "undefined") return;

    let id = window.localStorage.getItem(VISITOR_ID_STORAGE_KEY);

    if (!id) {
      id = createVisitorId();
      window.localStorage.setItem(VISITOR_ID_STORAGE_KEY, id);
    }

    setRoomId(id);
  }, []);

  // Shared loader (initial + polling) – uses the resolved roomId
  const loadMessages = async (currentRoomId: string, skipLoading?: boolean) => {
    try {
      if (!skipLoading && messages.length === 0) setLoading(true);

      const res = await fetch(`/api/chat/${currentRoomId}?t=${Date.now()}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({} as any));

      if (Array.isArray(data.items)) {
        setMessages(data.items as ChatMessage[]);
      }
    } catch (err) {
      console.error("Failed to load chat messages:", err);
      setError("Could not load chat history.");
    } finally {
      if (!skipLoading) setLoading(false);
    }
  };

  // Initial load + poll every 5s once roomId is known
  useEffect(() => {
    if (!roomId) return;

    loadMessages(roomId);

    const id = setInterval(() => {
      loadMessages(roomId, true);
    }, 5000);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // ---------------- Check if we already have a profile ----------------
  useEffect(() => {
    if (!roomId) return;

    // capture a non-null copy for the async function
    const currentRoomId: string = roomId;

    let cancelled = false;

    async function checkProfile(roomIdForFetch: string) {
      try {
        const encodedRoomId = encodeURIComponent(roomIdForFetch);

        const res = await fetch(`/api/users/room/${encodedRoomId}`);
        if (!res.ok) {
          // No profile yet or some other error — just ignore for now
          return;
        }

        const data = await res.json().catch(() => ({} as any));

        if (!cancelled && data && data.item) {
          setHasSharedProfile(true);

          if (typeof data.item.name === "string") {
            setNameDraft(data.item.name);
          }

          if (typeof data.item.interest === "string") {
            setInterestDraft(data.item.interest);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error("checkProfile failed:", err);
        }
      }
    }

    checkProfile(currentRoomId);

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  // ---------------- Save profile (name + interest) ----------------
  async function handleProfileSave(e: FormEvent) {
    e.preventDefault();
    if (!roomId || profileSaving) return;

    const name = nameDraft.trim();
    const interest = interestDraft.trim();

    if (!name && !interest) {
      setProfileError("Please share at least your name or what you like.");
      return;
    }

    setProfileSaving(true);
    setProfileError(null);
    setProfileSavedMessage(null);

    try {
      const encodedRoomId = encodeURIComponent(roomId);

      // This payload now matches /api/users/room/[roomId] expectations
      const payload = {
        name,
        interest,
        source: "mobile-chat",
        tags: ["concierge-request"], // helps the admin filter “concierge requests”
      };

      const res = await fetch(`/api/users/room/${encodedRoomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({} as any));

      if (!res.ok || !data.item) {
        throw new Error(
          (data && data.message) || "Could not save your details."
        );
      }

      setHasSharedProfile(true);

      if (typeof data.item.name === "string") {
        setNameDraft(data.item.name);
      }
      if (typeof data.item.interest === "string") {
        setInterestDraft(data.item.interest);
      }

      setProfileSavedMessage("Saved! Your concierge now knows who you are.");
    } catch (err) {
      console.error("handleProfileSave failed:", err);
      setProfileError("Could not save your details. Please try again.");
    } finally {
      setProfileSaving(false);
    }
  }

  // ---------------- Send message (with optimistic UI) ----------------
  async function handleSend(e: FormEvent) {
    e.preventDefault();

    if (!roomId) return; // safety: no room yet

    const text = input.trim();
    if ((!text && !attachmentName) || sending) return;

    setSending(true);
    setError(null);

    const tempId = `temp-${Date.now()}`;
    const userMessage: ChatMessage = {
      id: tempId,
      sender: "user",
      text: text || "",
      createdAt: new Date().toISOString(),
      attachmentName,
      attachmentKind: attachmentName ? "image" : null, // mock
    };

    // optimistic add
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    try {
      const body: any = {
        text,
        sender: "user" as const,
        userId: roomId, // <-- identity sent to backend
      };

      if (attachmentName) {
        body.attachmentName = attachmentName;
        body.attachmentKind = "image"; // treat as image/file mock
      }

      const res = await fetch(`/api/chat/${roomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Chat send failed");
      }

      // Replace temp with real one + concierge reply (if any)
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        const final: ChatMessage[] = [...withoutTemp];

        if (data.item) {
          final.push(data.item as ChatMessage);
        }
        if (data.reply) {
          final.push(data.reply as ChatMessage);
        }

        return final;
      });

      // Clear attachment after successful send
      setAttachmentName(null);
    } catch (err) {
      console.error("Chat send error", err);
      setError("Could not send message. Please try again.");

      // rollback optimistic message
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  // ---------------- UI ----------------
  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col">
      <header className="px-4 pt-4 pb-2 border-b border-slate-800">
        <h1 className="text-lg font-semibold">Chat with Foundzie</h1>
        <p className="text-xs text-slate-400">
          Ask for help, ideas, or concierge requests.
        </p>
        {roomId && (
          <p className="text-[10px] text-slate-500 mt-1">
            Visitor ID: <span className="font-mono">{roomId}</span>
          </p>
        )}
      </header>

      {/* tiny profile card */}
      {roomId && (
        <section className="px-4 pt-3 pb-1 border-b border-slate-800 bg-slate-900/40">
          <form
            onSubmit={handleProfileSave}
            className="flex flex-col gap-2 text-[11px]"
          >
            <p className="text-slate-300">
              {hasSharedProfile
                ? "You can update your details anytime to help your concierge personalise suggestions."
                : "Tell Foundzie who you are so your concierge can personalise recommendations."}
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="Your name (e.g. Kashif)"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-full px-3 py-1.5 text-[11px] outline-none focus:border-pink-500"
              />
              <input
                value={interestDraft}
                onChange={(e) => setInterestDraft(e.target.value)}
                placeholder="What you like (e.g. food & music in 60515)"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-full px-3 py-1.5 text-[11px] outline-none focus:border-pink-500"
              />
              <button
                type="submit"
                disabled={profileSaving || !roomId}
                className="px-3 py-1.5 text-[11px] rounded-full bg-emerald-600 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {profileSaving ? "Saving..." : "Save"}
              </button>
            </div>

            {profileError && (
              <p className="text-[11px] text-red-400">{profileError}</p>
            )}
            {profileSavedMessage && (
              <p className="text-[11px] text-emerald-400">
                {profileSavedMessage}
              </p>
            )}
          </form>
        </section>
      )}

      {/* messages area */}
      <section className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {(!roomId || loading) && (
          <p className="text-xs text-slate-500">Loading conversation...</p>
        )}

        {roomId && !loading && messages.length === 0 && (
          <p className="text-xs text-slate-500">
            No messages yet. Say hi and tell Foundzie what you need.
          </p>
        )}

        {roomId &&
          messages.map((msg, index) => {
            const isUser = msg.sender === "user";

            return (
              <div
                key={`${msg.id}-${index}`} // safe key
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={[
                    "max-w-[80%] rounded-2xl px-3 py-2 text-xs",
                    isUser
                      ? "bg-pink-600 text-white"
                      : "bg-slate-800 text-slate-100",
                  ].join(" ")}
                >
                  {!isUser && (
                    <p className="text-[10px] uppercase tracking-wide text-slate-300 mb-1">
                      Concierge
                    </p>
                  )}

                  {/* attachment chip, if any */}
                  {msg.attachmentName && (
                    <p className="text-[10px] mb-1 italic opacity-90">
                      {msg.attachmentName}
                    </p>
                  )}

                  <p className="whitespace-pre-wrap break-words">
                    {msg.text || (msg.attachmentName ? "(attachment)" : "")}
                  </p>

                  <p className="mt-1 text-[10px] text-slate-400 text-right">
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

      {/* error */}
      {error && (
        <section className="border-t border-slate-800 px-4 pt-1 pb-1">
          <p className="text-[11px] text-red-400">{error}</p>
        </section>
      )}

      {/* input + attach */}
      <section className="border-t border-slate-800 px-4 pb-3 space-y-1">
        {/* attachment preview chip */}
        {attachmentName && (
          <div className="flex items-center gap-2 text-[11px] text-slate-300 mb-1">
            <span className="px-2 py-[2px] rounded-full bg-slate-700">
              {attachmentName}
            </span>
            <button
              type="button"
              className="underline"
              onClick={() => setAttachmentName(null)}
            >
              remove
            </button>
          </div>
        )}

        <form onSubmit={handleSend} className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <input
              id="mobile-chat-file"
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setAttachmentName(file.name);
                }
              }}
            />
            <label
              htmlFor="mobile-chat-file"
              className="px-2 py-1 text-[11px] rounded-full border border-slate-700 cursor-pointer"
            >
              Attach
            </label>
          </div>

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-slate-900 border border-slate-700 rounded-full px-3 py-2 text-xs outline-none focus:border-pink-500"
          />

          <button
            type="submit"
            disabled={
              sending || (!input.trim() && !attachmentName) || !roomId
            }
            className="px-3 py-2 text-xs rounded-full bg-pink-600 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </form>
      </section>
    </main>
  );
}
