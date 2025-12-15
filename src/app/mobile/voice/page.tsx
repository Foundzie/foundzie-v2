"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { ChatMessage } from "@/app/data/chat";

const VISITOR_ID_STORAGE_KEY = "foundzie_visitor_id";

function createVisitorId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `visitor-${crypto.randomUUID()}`;
  }
  return `visitor-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
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
    .map((m) => `${m.sender === "user" ? "User" : "Foundzie"}: ${m.text ?? ""}`.trim())
    .filter(Boolean)
    .join("\n");
}

export default function MobileVoicePage() {
  const [roomId, setRoomId] = useState<string | null>(null);

  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "ended" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  const [muted, setMuted] = useState(false);
  const [events, setEvents] = useState<EventLogItem[]>([]);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // voice → shared memory buffers
  const userTextBufRef = useRef<string>("");
  const assistantTextBufRef = useRef<string>("");
  const lastUserCommitRef = useRef<string>("");
  const lastAssistantCommitRef = useRef<string>("");

  const canUseWebRTC = useMemo(() => {
    return typeof window !== "undefined" && "RTCPeerConnection" in window;
  }, []);

  // roomId boot
  useEffect(() => {
    if (typeof window === "undefined") return;

    let id = window.localStorage.getItem(VISITOR_ID_STORAGE_KEY);
    if (!id) {
      id = createVisitorId();
      window.localStorage.setItem(VISITOR_ID_STORAGE_KEY, id);
    }
    setRoomId(id);
  }, []);

  function logEvent(type: string, text?: string) {
    setEvents((prev) => [
      {
        ts: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        type,
        text,
      },
      ...prev,
    ].slice(0, 60));
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
      const res = await fetch(`/api/chat/${encoded}?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return "";
      const data = await res.json().catch(() => ({} as any));
      const items = Array.isArray(data?.items) ? (data.items as ChatMessage[]) : [];
      return formatThreadForVoice(items, 14);
    } catch {
      return "";
    }
  }

  async function bootstrapSessionUpdate() {
    if (!roomId) return;

    // Fetch user profile context so voice is personalized
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
        ? `User name: ${name}.`
        : "User name unknown.";

    const interestLine = interest ? `User interests/context: ${interest}.` : "";
    const tagsLine = tags.length ? `User tags: ${tags.join(", ")}.` : "";

    // M9d: Pull shared chat memory
    const thread = await fetchThreadContext(roomId);

    // IMPORTANT: session.type + output_modalities (not modalities)
    safeSend({
      type: "session.update",
      session: {
        type: "realtime",
        model: "gpt-realtime",
        output_modalities: ["audio", "text"],
        turn_detection: { type: "server_vad" },
        instructions: [
          "You are Foundzie, a lightning-fast personal concierge.",
          "You are speaking in real time on a voice call inside the app (WebRTC).",
          "Be warm, natural, and human. Keep answers short (1–3 sentences).",
          "Ask at most ONE follow-up question when needed.",
          identityLine,
          interestLine,
          tagsLine,
          thread ? `Conversation so far (shared memory):\n${thread}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    });

    logEvent(
      "session.update",
      thread ? "Voice persona + shared memory loaded." : "Voice persona configured."
    );
  }

  function absorbRealtimeEvent(msg: any) {
    const type = typeof msg?.type === "string" ? msg.type : "";

    // Realtime versions vary; we try common fields safely.
    const transcriptText =
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
      const t = transcriptText.trim();
      if (t) {
        userTextBufRef.current = t;
        if (t !== lastUserCommitRef.current) {
          lastUserCommitRef.current = t;
          postTurn("user", t).catch(() => {});
        }
      }
      return;
    }

    // ASSISTANT text streaming (delta)
    // (some versions: response.output_text.delta, others: response.output_audio_transcript.delta)
    if (type.includes("response") && type.includes("delta")) {
      // Prefer transcript deltas if present; fall back to delta/text fields
      if (transcriptText) assistantTextBufRef.current += transcriptText;
      return;
    }

    // ASSISTANT completed
    if (type.includes("response") && (type.includes("done") || type.includes("completed"))) {
      const t = assistantTextBufRef.current.trim();
      assistantTextBufRef.current = "";
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

    setStatus("connecting");
    logEvent("connecting", "Starting microphone + WebRTC session…");

    try {
      // 1) Microphone
      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      localStreamRef.current = localStream;

      // 2) Peer connection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Remote audio output
      pc.ontrack = (evt) => {
        const [remoteStream] = evt.streams;
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream;
          remoteAudioRef.current.play().catch(() => {});
        }
        logEvent("remote_track", "Remote audio track connected.");
      };

      // Add mic tracks
      for (const track of localStream.getTracks()) {
        pc.addTrack(track, localStream);
      }

      // 3) Data channel
      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      dc.onopen = () => {
        logEvent("datachannel_open", "Control channel connected.");
        bootstrapSessionUpdate().catch(() => {});

        // greet once
        safeSend({
          type: "response.create",
          response: {
            // IMPORTANT: output_modalities (not modalities)
            output_modalities: ["audio", "text"],
            instructions:
              "Greet the user briefly as Foundzie (one short sentence), then wait for them to speak.",
          },
        });
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

      // 4) Create SDP offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 5) POST SDP to server
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
        throw new Error(j?.message || "Failed to create realtime session.");
      }

      const answerSdp = await sdpRes.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      setStatus("connected");
      logEvent("connected", "Live voice session ready.");
      await setVoiceSessionStatus("active");
    } catch (e: any) {
      console.error("[voice] start error:", e);
      const msg = typeof e?.message === "string" ? e.message : "Voice start failed.";
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
    for (const t of stream.getAudioTracks()) {
      t.enabled = !next;
    }
    setMuted(next);
    logEvent(next ? "muted" : "unmuted");
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white pb-14">
      <header className="px-4 py-4 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link href="/mobile/chat" className="text-xs text-slate-400">
            &larr; Back
          </Link>
          <h1 className="text-lg font-semibold">Live Voice (WebRTC)</h1>
        </div>
        {roomId ? <span className="text-[10px] text-slate-500 font-mono">{roomId}</span> : null}
      </header>

      <section className="px-4 py-4 space-y-3">
        <p className="text-xs text-slate-400">
          This is the realtime voice concierge. Tap Start, allow microphone, and speak naturally.
        </p>

        {error && (
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-800">
            <p className="text-xs text-red-200">{error}</p>
          </div>
        )}

        {!canUseWebRTC && (
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <p className="text-xs text-slate-200">WebRTC is not available in this browser.</p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={start}
            disabled={!canUseWebRTC || status === "connecting" || status === "connected"}
            className="flex-1 px-4 py-2 rounded-full bg-emerald-600 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {status === "connecting" ? "Starting…" : status === "connected" ? "Live ✅" : "Start voice"}
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
            <p className="text-xs text-slate-400 mt-2">No events yet. Start voice to see live activity.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {events.map((e, idx) => (
                <li key={`${e.ts}-${idx}`} className="text-xs">
                  <span className="text-slate-500 font-mono mr-2">{e.ts}</span>
                  <span className="text-slate-200">{e.type}</span>
                  {e.text ? <span className="text-slate-400"> — {String(e.text).slice(0, 180)}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="text-[11px] text-slate-500">
          Tip: M9d is now active — voice remembers chat, and voice turns get saved back into chat automatically.
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
