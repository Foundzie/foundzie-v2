// src/app/mobile/chat/page.tsx
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
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

type VoiceStatus = "none" | "requested" | "active" | "ended" | "failed";

export default function MobileChatPage() {
  const router = useRouter();

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
  const [profileSavedMessage, setProfileSavedMessage] =
    useState<string | null>(null);

  // Voice sheet state (M5a)
  const [showVoiceSheet, setShowVoiceSheet] = useState(false);
  const [voiceRequestError, setVoiceRequestError] = useState<string | null>(
    null
  );
  const [voiceRequesting, setVoiceRequesting] = useState(false);

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

      const encodedRoomId = encodeURIComponent(currentRoomId);
      const res = await fetch(`/api/chat/${encodedRoomId}?t=${Date.now()}`, {
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

    const currentRoomId: string = roomId;
    let cancelled = false;

    async function checkProfile(roomIdForFetch: string) {
      try {
        const encodedRoomId = encodeURIComponent(roomIdForFetch);

        const res = await fetch(`/api/users/room/${encodedRoomId}`);
        if (!res.ok) {
          return;
        }

        const data = await res.json().catch(() => ({} as any));
        const user = data?.item;
        if (!user || cancelled) return;

        const apiName =
          typeof user.name === "string" ? (user.name as string) : "";
        const apiInterest =
          typeof user.interest === "string"
            ? (user.interest as string)
            : "";

        const isAnonymous = apiName
          .toLowerCase()
          .startsWith("anonymous visitor");

        setNameDraft(isAnonymous ? "" : apiName);
        setInterestDraft(apiInterest);

        setHasSharedProfile(!isAnonymous && (!!apiName || !!apiInterest));
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

      const payload = {
        name,
        interest,
        source: "mobile-chat",
        tags: ["concierge-request"],
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

    if (!roomId) return;

    const rawText = input.trim();
    if ((!rawText && !attachmentName) || sending) return;

    setSending(true);
    setError(null);

    const tempId = `temp-${Date.now()}`;
    const userMessage: ChatMessage = {
      id: tempId,
      sender: "user",
      text: rawText || "",
      createdAt: new Date().toISOString(),
      attachmentName,
      attachmentKind: attachmentName ? "image" : null, // mock
    };

    // optimistic add – show exactly what user typed
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    // 🔹 Trip-planner transform (M10a):
    // If the message starts with "plan:", we wrap it in a special
    // instruction so the agent returns a short itinerary.
    let transformedText = rawText;
    const lower = rawText.toLowerCase();

    if (lower.startsWith("plan:")) {
      const userRequest = rawText.slice(5).trim() || "Plan something fun for me.";
      transformedText =
        "TRIP_PLANNER_REQUEST:\n" +
        "You are Foundzie, a local concierge trip planner. " +
        "Create a short, step-by-step plan with 2–4 stops, including rough timing " +
        "(like '6:00pm', '7:30pm') and 1–2 sentences per stop, based on this request:\n\n" +
        userRequest +
        "\n\nKeep the answer concise and easy to follow, like you’re texting the user.";
    }

    try {
      const body: any = {
        text: transformedText,
        sender: "user" as const,
        userId: roomId, // identity sent to backend
        roomId, // explicitly tell backend which chat room
      };

      if (attachmentName) {
        body.attachmentName = attachmentName;
        body.attachmentKind = "image";
      }

      const encodedRoomId = encodeURIComponent(roomId);

      const res = await fetch(`/api/chat/${encodedRoomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Chat send failed");
      }

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

      setAttachmentName(null);
    } catch (err) {
      console.error("Chat send error", err);
      setError("Could not send message. Please try again.");

      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(rawText);
    } finally {
      setSending(false);
    }
  }

  // ---------------- Voice: create session + go to concierge ----------------
  async function handleVoiceConciergeClick() {
    if (!roomId) {
      // just in case, still navigate so user can type phone in concierge form
      router.push("/mobile/concierge");
      return;
    }

    setVoiceRequesting(true);
    setVoiceRequestError(null);

    try {
      const res = await fetch("/api/voice/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          status: "requested" as VoiceStatus,
        }),
      });

      const data = await res.json().catch(() => ({} as any));

      if (!res.ok) {
        const message =
          typeof data === "object" && data && "message" in data
            ? String((data as { message?: unknown }).message)
            : "Voice session request failed";
        throw new Error(message);
      }
    } catch (err) {
      console.error("Failed to request voice session from mobile:", err);
      setVoiceRequestError(
        "We couldn’t flag your call request, but your concierge can still call you from the next screen."
      );
      // we still continue to concierge page
    } finally {
      setVoiceRequesting(false);
      setShowVoiceSheet(false);
      router.push("/mobile/concierge");
    }
  }

  // ---------------- UI ----------------
  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col">
      <header className="px-4 pt-4 pb-2 border-b border-slate-800">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Chat with Foundzie</h1>
            <p className="text-xs text-slate-400">
              Ask for help, ideas, or concierge requests.
            </p>
            {roomId && (
              <p className="text-[10px] text-slate-500 mt-1">
                Visitor ID: <span className="font-mono">{roomId}</span>
              </p>
            )}
          </div>

          {/* Voice button scaffold */}
          <button
            type="button"
            onClick={() => setShowVoiceSheet(true)}
            className="self-center px-3 py-1.5 rounded-full bg-purple-600 text-[11px] font-medium hover:bg-purple-500"
          >
            Talk to Foundzie
          </button>
        </div>
      </header>

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
                key={`${msg.id}-${index}`}
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

      {error && (
        <section className="border-t border-slate-800 px-4 pt-1 pb-1">
          <p className="text-[11px] text-red-400">{error}</p>
        </section>
      )}

      <section className="border-t border-slate-800 px-4 pb-3 space-y-1">
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

        {/* M10a: Quick trip-planner suggestions */}
        {roomId && (
          <div className="flex flex-wrap items-center gap-2 mb-1 text-[11px] text-slate-300">
            <span className="text-slate-500">Try:</span>
            <button
              type="button"
              className="px-2 py-[2px] rounded-full bg-slate-800 border border-slate-700 hover:bg-slate-700"
              onClick={() =>
                setInput(
                  "plan: Plan a fun evening near 60515 for two adults who like burgers and arcade games."
                )
              }
            >
              Plan tonight in 60515
            </button>
            <button
              type="button"
              className="px-2 py-[2px] rounded-full bg-slate-800 border border-slate-700 hover:bg-slate-700"
              onClick={() =>
                setInput(
                  "plan: Plan a relaxed family afternoon nearby with kid-friendly places."
                )
              }
            >
              Family afternoon nearby
            </button>
            <button
              type="button"
              className="px-2 py-[2px] rounded-full bg-slate-800 border border-slate-700 hover:bg-slate-700"
              onClick={() =>
                setInput(
                  "plan: Plan a cozy date night in or near 60515 with dinner and one fun activity."
                )
              }
            >
              Date night in 60515
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
            placeholder="Type a message... (try: plan: Plan a fun evening near 60515)"
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

      {/* Voice sheet */}
      {showVoiceSheet && (
        <div
          className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-30"
          onClick={() => setShowVoiceSheet(false)}
        >
          <div
            className="bg-slate-900 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">
                Talk to Foundzie (voice)
              </h2>
              <button
                type="button"
                onClick={() => setShowVoiceSheet(false)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Close
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Voice calls are coming soon. For now, your concierge can call you
              by phone. We&rsquo;ll flag your request and then take you to a
              quick form to confirm your number.
            </p>

            {voiceRequestError && (
              <p className="text-[11px] text-amber-300">
                {voiceRequestError}
              </p>
            )}

            <button
              type="button"
              onClick={handleVoiceConciergeClick}
              disabled={voiceRequesting}
              className="w-full px-4 py-2 rounded-full bg-purple-600 text-xs font-medium text-white hover:bg-purple-500 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {voiceRequesting ? "Requesting…" : "Call me via concierge"}
            </button>

            <button
              type="button"
              onClick={() => setShowVoiceSheet(false)}
              className="w-full px-4 py-2 rounded-full bg-slate-800 text-xs font-medium text-slate-100 hover:bg-slate-700"
            >
              Keep chatting
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
