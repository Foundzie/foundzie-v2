// src/app/mobile/voice/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

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

export default function MobileVoicePage() {
  const [roomId, setRoomId] = useState<string | null>(null);

  const [status, setStatus] = useState<
    "idle" | "connecting" | "connected" | "ended" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  const [muted, setMuted] = useState(false);
  const [events, setEvents] = useState<EventLogItem[]>([]);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

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
    ].slice(0, 50));
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

    // If already running, ignore
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

      // Add mic track(s)
      for (const track of localStream.getTracks()) {
        pc.addTrack(track, localStream);
      }

      // 3) Data channel (events + control messages)
      // Docs commonly use an events channel for client/server events. 
      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      dc.onopen = () => {
        logEvent("datachannel_open", "Control channel connected.");

        // Pull lightweight user context (name/interest/tags) so voice feels personal.
        // (This is a first step toward M9d; full shared memory comes next.)
        bootstrapSessionUpdate().catch(() => {});

        // Optional: Ask Foundzie to greet the user once connected.
        // Some setups require an explicit response.create event. 
        safeSend({
          type: "response.create",
          response: {
            modalities: ["audio", "text"],
            instructions:
              "Greet the user briefly as Foundzie (one short sentence), then wait for them to speak.",
          },
        });
      };

      dc.onmessage = (evt) => {
        // We’ll log key event types; later we can build full transcript UI.
        try {
          const msg = JSON.parse(String(evt.data));
          const t = typeof msg?.type === "string" ? msg.type : "event";
          // Capture a little text when present (avoid spamming huge payloads)
          let preview: string | undefined;

          if (typeof msg?.delta === "string") preview = msg.delta;
          if (typeof msg?.text === "string") preview = msg.text;
          if (typeof msg?.error?.message === "string") preview = msg.error.message;

          logEvent(t, preview);
        } catch {
          logEvent("message", String(evt.data).slice(0, 200));
        }
      };

      dc.onerror = () => {
        logEvent("datachannel_error");
      };

      // 4) Create SDP offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 5) Send offer.sdp to our server → OpenAI → get answer SDP back
      const sdpRes = await fetch("/api/realtime/session", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: offer.sdp ?? "",
      });

      if (!sdpRes.ok) {
        const j = await sdpRes.json().catch(() => null);
        throw new Error(j?.message || "Failed to create realtime session.");
      }

      const answerSdp = await sdpRes.text();
      const answer: RTCSessionDescriptionInit = {
        type: "answer",
        sdp: answerSdp,
      };
      await pc.setRemoteDescription(answer);

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

  function safeSend(payload: any) {
    try {
      const dc = dcRef.current;
      if (!dc || dc.readyState !== "open") return;
      dc.send(JSON.stringify(payload));
    } catch {
      // ignore
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

    // session.update lets us steer instructions + turn detection, etc. 
    safeSend({
      type: "session.update",
      session: {
        instructions: [
          "You are Foundzie, a lightning-fast personal concierge.",
          "Be warm, confident, and practical.",
          "Keep answers short and conversational (1–3 sentences) unless the user asks for detail.",
          "If the user asks for nearby places, assume they mean near their home city/ZIP in their profile when available; otherwise ask ONE quick clarifying question.",
          identityLine,
          interestLine,
          tagsLine,
        ]
          .filter(Boolean)
          .join("\n"),
        // Let the server detect when the user stops speaking (hands-free feel).
        // 
        turn_detection: { type: "server_vad" },
        // Ask for text alongside audio so we can display transcript later.
        // (We’ll use this more in M9d.)
        modalities: ["audio", "text"],
      },
    });

    logEvent("session.update", "Voice persona + VAD configured.");
  }

  async function stopInternal() {
    // close datachannel
    try {
      dcRef.current?.close();
    } catch {}
    dcRef.current = null;

    // close peer connection
    try {
      pcRef.current?.close();
    } catch {}
    pcRef.current = null;

    // stop mic tracks
    try {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}
    localStreamRef.current = null;

    // clear remote audio
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
        {roomId ? (
          <span className="text-[10px] text-slate-500 font-mono">{roomId}</span>
        ) : null}
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
            <p className="text-xs text-slate-200">
              WebRTC is not available in this browser.
            </p>
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

        {/* Remote audio sink */}
        <audio ref={remoteAudioRef} autoPlay playsInline />

        <div className="mt-3 p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Realtime events</h2>
            <span className="text-[10px] text-slate-400">
              {status === "connected"
                ? "connected"
                : status === "connecting"
                ? "connecting"
                : status === "ended"
                ? "ended"
                : status === "error"
                ? "error"
                : "idle"}
            </span>
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
                    <span className="text-slate-400"> — {String(e.text).slice(0, 180)}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="text-[11px] text-slate-500">
          Tip: If you hear nothing, confirm your browser audio output is enabled and microphone permission is granted.
        </div>
      </section>

      {/* Bottom nav (keep consistent with your other mobile pages) */}
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
