// src/app/mobile/chat/page.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import type { ChatMessage } from "../../data/chat";

export default function MobileChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // shared loader (used by initial load + polling)
  const loadMessages = async () => {
    try {
      if (messages.length === 0) setLoading(true);
      const res = await fetch(`/api/chat?t=${Date.now()}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (Array.isArray(data.items)) {
        setMessages(data.items as ChatMessage[]);
      }
    } catch (err) {
      console.error("Failed to load chat messages:", err);
      setError("Could not load chat history.");
    } finally {
      setLoading(false);
    }
  };

  // initial load
  useEffect(() => {
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // poll every 5 seconds
  useEffect(() => {
    const id = setInterval(() => {
      loadMessages();
    }, 5000);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // send message (with optimistic UI)
  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();

    // must have either text or an attachment
    if ((!text && !attachmentName) || sending) return;

    setSending(true);
    setError(null);

    const tempId = `temp-${Date.now()}`;
    const userMessage: ChatMessage = {
      id: tempId,
      sender: "user",
      text,
      createdAt: new Date().toISOString(),
      attachmentName: attachmentName,
      attachmentKind: attachmentName ? "image" : null,
    };

    // optimistic add
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    try {
      const body: any = { text, sender: "user" as const };
      if (attachmentName) {
        body.attachmentName = attachmentName;
        body.attachmentKind = "image"; // for now we treat as image/file mock
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Chat send failed");
      }

      // replace temp with real + concierge reply (if any)
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

      // clear attachment after successful send
      setAttachmentName(null);
    } catch (err) {
      console.error("Chat send error:", err);
      setError("Could not send message. Please try again.");

      // rollback optimistic message
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col">
      <header className="px-4 pt-4 pb-2 border-b border-slate-800">
        <h1 className="text-lg font-semibold">Chat with Foundzie</h1>
        <p className="text-xs text-slate-400">
          Ask for help, ideas, or concierge requests.
        </p>
      </header>

      {/* messages area */}
      <section className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {loading && (
          <p className="text-xs text-slate-500">Loading conversation...</p>
        )}

        {!loading && messages.length === 0 && (
          <p className="text-xs text-slate-500">
            No messages yet. Say hi and tell Foundzie what you need.
          </p>
        )}

        {messages.map((msg) => {
          const isUser = msg.sender === "user";
          return (
            <div
              key={msg.id}
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
                    📎 {msg.attachmentName}
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
      <section className="border-t border-slate-800 p-3 space-y-1">
        {/* attachment preview chip */}
        {attachmentName && (
          <div className="flex items-center gap-2 text-[11px] text-slate-300 mb-1">
            <span className="px-2 py-[2px] rounded-full bg-slate-700">
              📎 {attachmentName}
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

        <form
          onSubmit={handleSend}
          className="flex items-center gap-2"
        >
          {/* attach button */}
          <div>
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
              📎 Attach
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
            disabled={sending || (!input.trim() && !attachmentName)}
            className="px-3 py-2 text-xs rounded-full bg-pink-600 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </form>
      </section>
    </main>
  );
}
