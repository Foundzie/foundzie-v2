// src/app/mobile/voice/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { ChatMessage } from "@/app/data/chat";

const VISITOR_ID_STORAGE_KEY = "foundzie_visitor_id";

function createVisitorId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `visitor-${crypto.randomUUID()}`;
  }
  return `visitor-${Date.now().toString(16)}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

type VoiceStatus = "none" | "requested" | "active" | "ended" | "failed";

type EventLogItem = {
  ts: string;
  type: string;
  text?: string;
};

function formatThreadForVoice(items: ChatMessage[], max = 14) {
  const tail = items.slice(Math.max(0, items.length - max));
  return tail
    .map((m) =>
      `${m.sender === "user" ? "User" : "Foundzie"}: ${m.text ?? ""}`.trim()
    )
    .filter(Boolean)
    .join("\n");
}

type RoomUser = {
  id?: string | number;
  name?: string;
  phone?: string | null;
  email?: string;
  interest?: string;
  tags?: string[];
};

function normalizePhoneForUX(phone?: string | null) {
  const p = String(phone || "").trim();
  return p;
}

export default function MobileVoicePage() {
  const [roomId, setRoomId] = useState<string | null>(null);

  // WebRTC state
  const [status, setStatus] = useState<
    "idle" | "connecting" | "connected" | "ended" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  // “Call me” (Twilio) state
  const [callMeStatus, setCallMeStatus] = useState<
    "idle" | "loading-profile" | "calling" | "called" | "error"
  >("idle");
  const [callMeError, setCallMeError] = useState<string | null>(null);
  const [profilePhone, setProfilePhone] = useState<string>("");

  const [muted, setMuted] = useState(false);
  const [events, setEvents] = useState<EventLogItem[]>([]);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Buffers for saving voice turns into chat
  const userTextBufRef = useRef<string>("");
  const assistantTranscriptBufRef = useRef<string>("");
  const lastUserCommitRef = useRef<string>("");
  const lastAssistantCommitRef = useRef<string>("");

  // Prevent re-sending session.update repeatedly if datachannel reconnects
  const didBootstrapRef = useRef<boolean>(false);

  const canUseWebRTC = useMemo(() => {
    return typeof window !== "undefined" && "RTCPeerConnection" in window;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let id = window.localStorage.getItem(VISITOR_ID_STORAGE_KEY);
    if (!id) {
      id = createVisitorId();
      window.localStorage.setItem(VISITOR_ID_STORAGE_KEY, id);
    }
    setRoomId(id);
  }, []);

  // Load profile phone once we have roomId (for M17 “Call me” UX)
  useEffect(() => {
    if (!roomId) return;

    let cancelled = false;

    async function loadRoomUserPhone(rid: string) {
      setCallMeStatus("loading-profile");
      setCallMeError(null);

      try {
        const encoded = encodeURIComponent(rid);
        const res = await fetch(`/api/users/room/${encoded}`, { cache: "no-store" });
        const data = (await res.json().catch(() => ({} as any))) as {
          ok?: boolean;
          item?: RoomUser;
        };

        const phone = normalizePhoneForUX(data?.item?.phone ?? "");
        if (!cancelled) {
          setProfilePhone(phone);
          setCallMeStatus("idle");
        }
      } catch (e: any) {
        if (!cancelled) {
          setCallMeStatus("error");
          setCallMeError("Could not load your profile. Please refresh and try again.");
        }
      }
    }

    loadRoomUserPhone(roomId);

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  function logEvent(type: string, text?: string) {
    setEvents((prev) =>
      [
        {
          ts: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          type,
          text,
        },
        ...prev,
      ].slice(0, 60)
    );
  }

  async function setVoiceSessionStatus(next: VoiceStatus, lastError?: string) {
    if (!roomId) return;
    try {
      await fetch("/api/voice/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          status: next,
          lastError: lastError ?? null,
        }),
      });
    } catch {
      // non-blocking
    }
  }

  function safeSend(payload: any) {
    try {
      const dc = dcRef.current;
      if (!dc || dc.readyState !== "open") return;
      dc.send(JSON.stringify(payload));
    } catch {
      // ignore
    }
  }

  async function postTurn(sender: "user" | "concierge", text: string) {
    if (!roomId) return;
    const clean = (text || "").trim();
    if (!clean) return;

    try {
      await fetch("/api/conversation/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, sender, text: clean }),
      });
    } catch {
      // non-blocking
    }
  }

  async function fetchThreadContext(roomIdVal: string) {
    try {
      const encoded = encodeURIComponent(roomIdVal);
      const res = await fetch(`/api/chat/${encoded}?t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!res.ok) return "";
      const data = await res.json().catch(() => ({} as any));
      const items = Array.isArray(data?.items)
        ? (data.items as ChatMessage[])
        : [];
      return formatThreadForVoice(items, 14);
    } catch {
      return "";
    }
  }

  async function bootstrapSessionUpdate() {
    if (!roomId) return;

    // Pull user profile context
    let name = "";
    let interest = "";
    let tags: string[] = [];

    try {
      const encoded = encodeURIComponent(roomId);
      const res = await fetch(`/api/users/room/${encoded}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json().catch(() => ({} as any));
        const u = data?.item;
        if (u) {
          if (typeof u.name === "string") name = u.name;
          if (typeof u.interest === "string") interest = u.interest;
          if (Array.isArray(u.tags)) tags = u.tags.map(String);
        }
      }
    } catch {
      // ignore
    }

    const identityLine =
      name && !name.toLowerCase().startsWith("anonymous visitor")
        ? `Caller name: ${name}.`
        : "Caller name unknown.";

    const interestLine = interest ? `Caller preferences/context: ${interest}.` : "";
    const tagsLine = tags.length ? `Caller tags: ${tags.join(", ")}.` : "";

    const thread = await fetchThreadContext(roomId);

    // AUDIO-ONLY; no turn_detection fields.
    safeSend({
      type: "session.update",
      session: {
        type: "realtime",
        instructions: [
          "SYSTEM / ROLE:",
          "You are Foundzie, a lightning-fast personal concierge.",
          "This is a LIVE voice call inside the Foundzie app (WebRTC).",
          "",
          "VOICE BEHAVIOR:",
          "- Speak natural, warm, confident English.",
          "- Keep responses short: 1–2 sentences.",
          "- Ask at most ONE follow-up question when necessary.",
          "- Do NOT repeat greetings or re-introduce yourself once the call is connected.",
          "- Do NOT say: 'Hey this is Foundzie' unless the user explicitly asks who you are.",
          "- IMPORTANT: Wait silently until the user speaks first. Do not start talking on connect.",
          "",
          "IDENTITY:",
          "- Your name is Foundzie.",
          "- Never call the user 'Foundzie'. The user is the caller.",
          identityLine,
          interestLine,
          tagsLine,
          thread ? `SHARED MEMORY (recent conversation):\n${thread}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        output_modalities: ["audio"],
      },
    });

    logEvent(
      "session.update",
      thread
        ? "Voice persona + shared memory loaded (wait for user to speak)."
        : "Voice persona configured (wait for user)."
    );
  }

  function absorbRealtimeEvent(msg: any) {
    const type = typeof msg?.type === "string" ? msg.type : "";

    const text =
      typeof msg?.transcript === "string"
        ? msg.transcript
        : typeof msg?.text === "string"
        ? msg.text
        : typeof msg?.delta === "string"
        ? msg.delta
        : "";

    // USER transcription completed
    if (
      type.includes("input_audio_transcription") &&
      (type.includes("completed") || type.includes("done"))
    ) {
      const t = (text || "").trim();
      if (t) {
        userTextBufRef.current = t;
        if (t !== lastUserCommitRef.current) {
          lastUserCommitRef.current = t;
          postTurn("user", t).catch(() => {});
        }
      }
      return;
    }

    // ASSISTANT transcript streaming
    if (
      type.includes("response.output_audio_transcript") &&
      type.includes("delta")
    ) {
      if (text) assistantTranscriptBufRef.current += text;
      return;
    }

    // ASSISTANT transcript completed
    if (
      type.includes("response.output_audio_transcript") &&
      (type.includes("done") || type.includes("completed"))
    ) {
      const t = assistantTranscriptBufRef.current.trim();
      assistantTranscriptBufRef.current = "";
      if (t && t !== lastAssistantCommitRef.current) {
        lastAssistantCommitRef.current = t;
        postTurn("concierge", t).catch(() => {});
      }
      return;
    }
  }

  async function start() {
    setError(null);

    if (!canUseWebRTC) {
      setStatus("error");
      setError("WebRTC is not supported in this browser.");
      return;
    }

    if (!roomId) {
      setStatus("error");
      setError("Missing roomId (visitor id). Refresh and try again.");
      return;
    }

    if (pcRef.current) return;

    // reset per session
    didBootstrapRef.current = false;
    assistantTranscriptBufRef.current = "";
    userTextBufRef.current = "";

    setStatus("connecting");
    logEvent("connecting", "Starting microphone + WebRTC session…");

    try {
      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      localStreamRef.current = localStream;

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      pc.oniceconnectionstatechange = () => {
        logEvent("ice_state", pc.iceConnectionState);
      };

      pc.ontrack = (evt) => {
        const [remoteStream] = evt.streams;
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream;
          remoteAudioRef.current.play().catch(() => {});
        }
        logEvent("remote_track", "Remote audio track connected.");
      };

      for (const track of localStream.getTracks()) pc.addTrack(track, localStream);

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      dc.onopen = () => {
        logEvent("datachannel_open", "Control channel connected.");

        // ✅ Only do persona/memory bootstrap; DO NOT force a greeting.
        if (!didBootstrapRef.current) {
          didBootstrapRef.current = true;
          bootstrapSessionUpdate().catch(() => {});
        }

        logEvent("ready", "Connected. Speak first — Foundzie will respond.");
      };

      dc.onmessage = (evt) => {
        try {
          const msg = JSON.parse(String(evt.data));
          const t = typeof msg?.type === "string" ? msg.type : "event";

          let preview: string | undefined;
          if (typeof msg?.delta === "string") preview = msg.delta;
          if (typeof msg?.text === "string") preview = msg.text;
          if (typeof msg?.error?.message === "string") preview = msg.error.message;

          logEvent(t, preview);
          absorbRealtimeEvent(msg);
        } catch {
          logEvent("message", String(evt.data).slice(0, 200));
        }
      };

      dc.onerror = () => logEvent("datachannel_error");

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch("/api/realtime/session", {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          "x-foundzie-room-id": roomId,
        },
        body: offer.sdp ?? "",
      });

      if (!sdpRes.ok) {
        const j = await sdpRes.json().catch(() => null);
        throw new Error(j?.message || "Realtime session creation failed.");
      }

      const answerSdp = await sdpRes.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      setStatus("connected");
      logEvent("connected", "Live voice session ready.");
      await setVoiceSessionStatus("active");
    } catch (e: any) {
      console.error("[voice] start error:", e);
      const msg =
        typeof e?.message === "string" ? e.message : "Voice start failed.";
      setError(msg);
      setStatus("error");
      logEvent("error", msg);
      await setVoiceSessionStatus("failed", msg);
      await stopInternal();
    }
  }

  async function stopInternal() {
    try {
      dcRef.current?.close();
    } catch {}
    dcRef.current = null;

    try {
      pcRef.current?.close();
    } catch {}
    pcRef.current = null;

    try {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}
    localStreamRef.current = null;

    if (remoteAudioRef.current) {
      try {
        remoteAudioRef.current.pause();
      } catch {}
      remoteAudioRef.current.srcObject = null;
    }
  }

  async function stop() {
    logEvent("ending", "Ending voice session…");
    await stopInternal();
    setStatus("ended");
    await setVoiceSessionStatus("ended");
  }

  function toggleMute() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !muted;
    for (const t of stream.getAudioTracks()) t.enabled = !next;
    setMuted(next);
    logEvent(next ? "muted" : "unmuted");
  }

  // ✅ M17: “Call me” using saved profile phone
  async function callMe() {
    setCallMeError(null);

    if (!roomId) {
      setCallMeStatus("error");
      setCallMeError("Missing visitor id. Refresh and try again.");
      return;
    }

    // Make sure we have a fresh phone from backend
    setCallMeStatus("loading-profile");

    let phone = "";
    try {
      const encoded = encodeURIComponent(roomId);
      const res = await fetch(`/api/users/room/${encoded}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({} as any));
      phone = normalizePhoneForUX(data?.item?.phone ?? "");
      setProfilePhone(phone);
    } catch {
      setCallMeStatus("error");
      setCallMeError("Could not load your profile. Please refresh and try again.");
      return;
    }

    if (!phone) {
      setCallMeStatus("error");
      setCallMeError("No phone number saved. Please add your phone in Profile first.");
      return;
    }

    setCallMeStatus("calling");

    try {
      const res = await fetch("/api/calls/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          note: "M17: Call me (from mobile voice)",
          mode: "voice",
          roomId,
        }),
      });

      const j = await res.json().catch(() => ({} as any));

      if (!res.ok || j?.ok === false) {
        const msg =
          typeof j?.message === "string"
            ? j.message
            : "Call request failed. Check number format (+1...) and try again.";
        setCallMeStatus("error");
        setCallMeError(msg);
        return;
      }

      setCallMeStatus("called");
      logEvent("call_me", `Outbound call requested. TwilioSid: ${j?.twilioSid ?? "n/a"}`);
      setTimeout(() => setCallMeStatus("idle"), 3500);
    } catch (e: any) {
      setCallMeStatus("error");
      setCallMeError("Call request failed. Please try again.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white pb-14">
      <header className="px-4 py-4 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link href="/mobile/chat" className="text-xs text-slate-400">
            &larr; Back
          </Link>
          <h1 className="text-lg font-semibold">Voice</h1>
        </div>
        {roomId ? (
          <span className="text-[10px] text-slate-500 font-mono">{roomId}</span>
        ) : null}
      </header>

      <section className="px-4 py-4 space-y-3">
        {/* ✅ M17 Call Me card */}
        <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">Call me</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Uses the phone saved in your Profile. No re-entry needed.
              </p>
            </div>
            <Link href="/mobile/profile" className="text-xs text-slate-300 underline">
              Profile
            </Link>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={callMe}
              disabled={callMeStatus === "calling" || callMeStatus === "loading-profile"}
              className="flex-1 px-4 py-2 rounded-full bg-indigo-600 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {callMeStatus === "loading-profile"
                ? "Checking profile…"
                : callMeStatus === "calling"
                ? "Calling…"
                : callMeStatus === "called"
                ? "Requested ✅"
                : "Call me (Twilio)"}
            </button>

            <div className="text-[10px] text-slate-400">
              {profilePhone ? `Saved: ${profilePhone}` : "No phone saved"}
            </div>
          </div>

          {callMeError && (
            <div className="mt-2 text-xs text-amber-200">
              {callMeError}{" "}
              {callMeError.toLowerCase().includes("profile") ||
              callMeError.toLowerCase().includes("phone") ? (
                <Link href="/mobile/profile" className="underline text-white">
                  Open Profile
                </Link>
              ) : null}
            </div>
          )}
        </div>

        <p className="text-xs text-slate-400">
          WebRTC: Tap Start, allow microphone, then speak naturally. (Foundzie waits for you to speak first.)
        </p>

        {error && (
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-800">
            <p className="text-xs text-red-200">{error}</p>
          </div>
        )}

        {!canUseWebRTC && (
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <p className="text-xs text-slate-200">
              WebRTC is not available in this browser.
            </p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={start}
            disabled={
              !canUseWebRTC || status === "connecting" || status === "connected"
            }
            className="flex-1 px-4 py-2 rounded-full bg-emerald-600 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {status === "connecting"
              ? "Starting…"
              : status === "connected"
              ? "Live ✅"
              : "Start WebRTC voice"}
          </button>

          <button
            type="button"
            onClick={toggleMute}
            disabled={status !== "connected"}
            className="px-4 py-2 rounded-full bg-slate-800 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {muted ? "Unmute" : "Mute"}
          </button>

          <button
            type="button"
            onClick={stop}
            disabled={status !== "connected"}
            className="px-4 py-2 rounded-full bg-rose-600 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            End
          </button>
        </div>

        <audio ref={remoteAudioRef} autoPlay playsInline />

        <div className="mt-3 p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Realtime events</h2>
            <span className="text-[10px] text-slate-400">{status}</span>
          </div>

          {events.length === 0 ? (
            <p className="text-xs text-slate-400 mt-2">
              No events yet. Start voice to see live activity.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {events.map((e, idx) => (
                <li key={`${e.ts}-${idx}`} className="text-xs">
                  <span className="text-slate-500 font-mono mr-2">{e.ts}</span>
                  <span className="text-slate-200">{e.type}</span>
                  {e.text ? (
                    <span className="text-slate-400">
                      {" "}
                      — {String(e.text).slice(0, 180)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="text-[11px] text-slate-500">
          Tip: Voice turns are saved back into chat via transcripts.
        </div>
      </section>

      <nav className="fixed bottom-0 left-0 right-0 bg-slate-950 border-t border-slate-800 flex justify-around py-2 text-xs text-slate-300">
        <Link href="/mobile">Home</Link>
        <Link href="/mobile/explore">Explore</Link>
        <Link href="/mobile/nearby">Nearby</Link>
        <Link href="/mobile/chat">Chat</Link>
        <Link href="/mobile/profile">Profile</Link>
      </nav>
    </main>
  );
}
