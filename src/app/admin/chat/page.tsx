// src/app/admin/chat/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ChatMessage } from "../../data/chat";

type SenderFilter = "all" | "user" | "concierge";

export default function AdminChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<SenderFilter>("all");

  useEffect(() => {
    async function loadMessages() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/chat", { cache: "no-store" });
        if (!res.ok) {
          throw new Error("Request failed");
        }
        const data = (await res.json()) as { items?: ChatMessage[] };
        if (Array.isArray(data.items)) {
          setMessages(data.items);
        }
      } catch (err) {
        console.error("Failed to load chat messages", err);
        setError("Could not load chat messages.");
      } finally {
        setLoading(false);
      }
    }

    loadMessages();
  }, []);

  const visibleMessages = messages.filter((m) =>
    filter === "all" ? true : m.sender === filter
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Chat inbox
          </h1>
          <p className="text-xs text-slate-500">
            Read recent conversations coming from the mobile chat. (Replies from
            admin will come in the next step.)
          </p>
        </div>

        <Link
          href="/admin"
          className="text-xs text-purple-600 hover:text-purple-700 underline"
        >
          ← Back to dashboard
        </Link>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 text-xs">
        <span className="text-slate-500">Filter:</span>
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`px-2 py-1 rounded-full border text-xs ${
            filter === "all"
              ? "bg-purple-600 text-white border-purple-600"
              : "border-slate-300 text-slate-600"
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setFilter("user")}
          className={`px-2 py-1 rounded-full border text-xs ${
            filter === "user"
              ? "bg-purple-600 text-white border-purple-600"
              : "border-slate-300 text-slate-600"
          }`}
        >
          Visitors
        </button>
        <button
          type="button"
          onClick={() => setFilter("concierge")}
          className={`px-2 py-1 rounded-full border text-xs ${
            filter === "concierge"
              ? "bg-purple-600 text-white border-purple-600"
              : "border-slate-300 text-slate-600"
          }`}
        >
          Concierge
        </button>
      </div>

      {/* Status messages */}
      {loading && (
        <p className="text-xs text-slate-500">Loading chat messages…</p>
      )}
      {error && (
        <p className="text-xs text-red-600">
          {error}
        </p>
      )}

      {/* Messages list */}
      {!loading && !error && (
        <div className="mt-2 space-y-2 max-h-[520px] overflow-y-auto border border-slate-200 rounded-lg p-3 bg-slate-50">
          {visibleMessages.length === 0 ? (
            <p className="text-xs text-slate-500">
              No messages match this filter yet.
            </p>
          ) : (
            visibleMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.sender === "user" ? "justify-start" : "justify-end"
                }`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl px-3 py-2 text-xs shadow-sm ${
                    msg.sender === "user"
                      ? "bg-white text-slate-800 border border-slate-200"
                      : "bg-purple-600 text-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span className="font-semibold">
                      {msg.sender === "user" ? "Visitor" : "Concierge"}
                    </span>
                    <span className="text-[10px] opacity-75">
                      {new Date(msg.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
