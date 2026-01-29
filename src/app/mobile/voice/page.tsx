// src/app/mobile/voice/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { ChatMessage } from "@/app/data/chat";

const VISITOR_ID_STORAGE_KEY = "foundzie_visitor_id";
const TWILIO_LIMIT_SECONDS = 5 * 60; // 5 minutes

function createVisitorId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `visitor-${crypto.randomUUID()}`;
  }
  return `visitor-${Date.now().toString(16)}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

type VoiceStatus = "none" | "requested" | "active" | "ended" | "failed";
type Mode = "idle" | "webrtc" | "twilio";

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

type Contact = {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
};

type LastLocation = {
  roomId: string;
  lat: number;
  lng: number;
  accuracy?: number | null;
  source?: string;
  updatedAt: string;
};

function normalizePhoneForUX(phone?: string | null) {
  return String(phone || "").trim();
}

export default function MobileVoicePage() {
  const [roomId, setRoomId] = useState<string | null>(null);

  // Unified mode (M18)
  const [mode, setMode] = useState<Mode>("idle");

  // WebRTC UI state
  const [status, setStatus] = useState<
    "idle" | "connecting" | "connected" | "ended" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  // Twilio fallback state
  const [callStatus, setCallStatus] = useState<
    "idle" | "loading-profile" | "calling" | "called" | "error"
  >("idle");
  const [callError, setCallError] = useState<string | null>(null);
  const [profilePhone, setProfilePhone] = useState<string>("");

  // Twilio 5-min UX limit
  const [twilioSecondsLeft, setTwilioSecondsLeft] = useState<number | null>(null);
  const twilioTimerRef = useRef<number | null>(null);

  // ✅ M19b: contacts picker state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string>("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [callContactError, setCallContactError] = useState<string | null>(null);

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

  const selectedContact = useMemo(() => {
    return contacts.find((c) => c.id === selectedContactId) ?? null;
  }, [contacts, selectedContactId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let id = window.localStorage.getItem(VISITOR_ID_STORAGE_KEY);
    if (!id) {
      id = createVisitorId();
      window.localStorage.setItem(VISITOR_ID_STORAGE_KEY, id);
    }
    setRoomId(id);
  }, []);

  // Load profile phone once we have roomId (used for Twilio fallback)
  useEffect(() => {
    if (!roomId) return;

    let cancelled = false;

    async function loadRoomUserPhone(rid: string) {
      setCallStatus("loading-profile");
      setCallError(null);

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
          setCallStatus("idle");
        }
      } catch {
        if (!cancelled) {
          setCallStatus("error");
          setCallError("Could not load your profile. Please refresh and try again.");
        }
      }
    }

    loadRoomUserPhone(roomId);

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  // ✅ M19b: load contacts for this roomId
  useEffect(() => {
    if (!roomId) return;

    let cancelled = false;

    async function loadContacts(rid: string) {
      setContactsLoading(true);
      setContactsError(null);

      try {
        const encoded = encodeURIComponent(rid);
        const res = await fetch(`/api/contacts?roomId=${encoded}`, { cache: "no-store" });

        const data = (await res.json().catch(() => ({} as any))) as {
          ok?: boolean;
          items?: Contact[];
          message?: string;
        };

        if (!res.ok || data?.ok === false) {
          throw new Error(data?.message || "Failed to load contacts");
        }

        const items = Array.isArray(data.items) ? data.items : [];

        if (!cancelled) {
          setContacts(items);
          if (!selectedContactId && items.length > 0) setSelectedContactId(items[0].id);
        }
      } catch (e: any) {
        if (!cancelled) {
          setContactsError(typeof e?.message === "string" ? e.message : "Could not load contacts.");
        }
      } finally {
        if (!cancelled) setContactsLoading(false);
      }
    }

    loadContacts(roomId);

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  function logEvent(type: string, text?: string) {
    setEvents((prev) =>
      [
        {
          ts: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
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
        body: JSON.stringify({ roomId, status: next, lastError: lastError ?? null }),
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

  async function fetchLocationLine(rid: string): Promise<string> {
  try {
    const res = await fetch(`/api/location?roomId=${encodeURIComponent(rid)}`, { cache: "no-store" });
    const j = (await res.json().catch(() => ({} as any))) as { ok?: boolean; item?: LastLocation | null };
    const loc = j?.item;
    if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng) || !loc.updatedAt) return "";

    // reverse geocode to get a human label
    const rr = await fetch(`/api/location/reverse?lat=${encodeURIComponent(String(loc.lat))}&lng=${encodeURIComponent(String(loc.lng))}`, { cache: "no-store" });
    const rj = await rr.json().catch(() => ({} as any));
    const label = typeof rj?.item?.label === "string" ? rj.item.label : "";

    const acc = loc.accuracy == null ? "n/a" : String(loc.accuracy);

    if (label) {
      return `User location: ${label} (accuracy ${acc}m), updatedAt=${loc.updatedAt}`;
    }

    // fallback if reverse fails
    return `User location: lat=${loc.lat}, lng=${loc.lng} (accuracy ${acc}m), updatedAt=${loc.updatedAt}`;
  } catch {
    return "";
  }
}


  async function bootstrapSessionUpdate() {
    if (!roomId) return;

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
    const locLine = await fetchLocationLine(roomId);

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
          locLine,
          thread ? `SHARED MEMORY (recent conversation):\n${thread}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        output_modalities: ["audio"],
      },
    });

    logEvent("session.update", locLine ? "WebRTC configured + location injected." : "WebRTC configured (no location yet).");
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

    if (type.includes("response.output_audio_transcript") && type.includes("delta")) {
      if (text) assistantTranscriptBufRef.current += text;
      return;
    }

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

  async function stopInternalWebRTC() {
    try { dcRef.current?.close(); } catch {}
    dcRef.current = null;

    try { pcRef.current?.close(); } catch {}
    pcRef.current = null;

    try { localStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    localStreamRef.current = null;

    if (remoteAudioRef.current) {
      try { remoteAudioRef.current.pause(); } catch {}
      remoteAudioRef.current.srcObject = null;
    }
  }

  function clearTwilioTimer() {
    if (twilioTimerRef.current) {
      window.clearInterval(twilioTimerRef.current);
      twilioTimerRef.current = null;
    }
    setTwilioSecondsLeft(null);
  }

  function startTwilioCountdown() {
    clearTwilioTimer();
    setTwilioSecondsLeft(TWILIO_LIMIT_SECONDS);

    twilioTimerRef.current = window.setInterval(() => {
      setTwilioSecondsLeft((prev) => {
        if (prev === null) return prev;
        if (prev <= 1) {
          clearTwilioTimer();
          logEvent("twilio_limit", "5 min reached — continue in chat.");
          window.location.href = "/mobile/chat";
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function callMeTwilioFallback(): Promise<boolean> {
    setCallError(null);

    if (!roomId) {
      setCallStatus("error");
      setCallError("Missing visitor id. Refresh and try again.");
      return false;
    }

    setCallStatus("loading-profile");
    let phone = "";

    try {
      const encoded = encodeURIComponent(roomId);
      const res = await fetch(`/api/users/room/${encoded}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({} as any));
      phone = normalizePhoneForUX(data?.item?.phone ?? "");
      setProfilePhone(phone);
    } catch {
      setCallStatus("error");
      setCallError("Could not load your profile. Please refresh and try again.");
      return false;
    }

    if (!phone) {
      setCallStatus("error");
      setCallError("No phone saved. Add your phone in Profile first.");
      return false;
    }

    setCallStatus("calling");

    try {
      const res = await fetch("/api/calls/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          note: "M18: Twilio fallback (from mobile voice)",
          mode: "voice",
          roomId,
        }),
      });

      const j = await res.json().catch(() => ({} as any));
      if (!res.ok || j?.ok === false) {
        const msg =
          typeof j?.message === "string"
            ? j.message
            : "Call failed. Check phone format (+1...) and try again.";
        setCallStatus("error");
        setCallError(msg);
        return false;
      }

      setCallStatus("called");
      setMode("twilio");
      startTwilioCountdown();
      logEvent("twilio_fallback", `Call requested. TwilioSid: ${j?.twilioSid ?? "n/a"}`);
      return true;
    } catch {
      setCallStatus("error");
      setCallError("Call request failed. Please try again.");
      return false;
    }
  }

  async function startWebRTC(): Promise<boolean> {
    setError(null);

    if (!canUseWebRTC) {
      setStatus("error");
      setError("WebRTC is not supported in this browser.");
      return false;
    }

    if (!roomId) {
      setStatus("error");
      setError("Missing visitor id. Refresh and try again.");
      return false;
    }

    if (pcRef.current) return true;

    didBootstrapRef.current = false;
    assistantTranscriptBufRef.current = "";
    userTextBufRef.current = "";

    setStatus("connecting");
    logEvent("connecting", "Starting microphone + WebRTC session…");

    try {
      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
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
        logEvent("remote_track", "Remote audio connected.");
      };

      for (const track of localStream.getTracks()) pc.addTrack(track, localStream);

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      dc.onopen = () => {
        logEvent("datachannel_open", "Control channel connected.");
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
      setMode("webrtc");
      logEvent("connected", "WebRTC voice session ready.");
      await setVoiceSessionStatus("active");
      return true;
    } catch (e: any) {
      const msg = typeof e?.message === "string" ? e.message : "WebRTC start failed.";
      setError(msg);
      setStatus("error");
      logEvent("webrtc_failed", msg);
      await setVoiceSessionStatus("failed", msg);
      await stopInternalWebRTC();
      return false;
    }
  }

  async function startConcierge() {
    clearTwilioTimer();
    setCallError(null);
    setError(null);

    logEvent("concierge_start", "Attempting WebRTC first…");

    const okWebrtc = await startWebRTC();
    if (okWebrtc) return;

    logEvent("fallback", "WebRTC failed — falling back to Twilio call.");
    await callMeTwilioFallback();
  }

  async function endWebRTC() {
    logEvent("ending", "Ending WebRTC session…");
    await stopInternalWebRTC();
    setStatus("ended");
    setMode("idle");
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

  function fmtCountdown(sec: number | null) {
    if (sec === null) return "";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function requestCallSelectedContact() {
    setCallContactError(null);
    if (!selectedContact) {
      setCallContactError("Select a contact first.");
      return;
    }
    setConfirmOpen(true);
  }

  async function confirmCallSelectedContact() {
    setCallContactError(null);

    if (!roomId) {
      setCallContactError("Missing visitor id. Refresh and try again.");
      return;
    }
    if (!selectedContact) {
      setCallContactError("Select a contact first.");
      return;
    }

    setConfirming(true);

    try {
      const res = await fetch("/api/calls/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: selectedContact.phone,
          note: `M19b: Call contact (${selectedContact.name})`,
          mode: "voice",
          roomId,
        }),
      });

      const j = await res.json().catch(() => ({} as any));
      if (!res.ok || j?.ok === false) {
        const msg =
          typeof j?.message === "string"
            ? j.message
            : "Call request failed. Check contact phone format (+1...) and try again.";
        setCallContactError(msg);
        return;
      }

      logEvent("call_contact", `Calling ${selectedContact.name}. TwilioSid: ${j?.twilioSid ?? "n/a"}`);
      setConfirmOpen(false);
    } catch {
      setCallContactError("Call request failed. Please try again.");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white pb-14">
      <header className="px-4 py-4 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link href="/mobile/chat" className="text-xs text-slate-400">
            &larr; Back
          </Link>
          <h1 className="text-lg font-semibold">Concierge</h1>
        </div>
        {roomId ? (
          <span className="text-[10px] text-slate-500 font-mono">{roomId}</span>
        ) : null}
      </header>

      <section className="px-4 py-4 space-y-3">
        <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
          <p className="text-sm font-semibold">Start Concierge</p>
          <p className="text-xs text-slate-400 mt-1">
            WebRTC first (unlimited). If it fails, we fall back to a Twilio phone call.
          </p>

          <button
            type="button"
            onClick={startConcierge}
            disabled={status === "connecting" || status === "connected" || callStatus === "calling"}
            className={[
              "mt-3 w-full px-4 py-2 rounded-full text-sm font-semibold text-white",
              "bg-gradient-to-r from-fuchsia-600 via-purple-600 to-indigo-600",
              "shadow-[0_12px_30px_rgba(124,58,237,0.35)]",
              "hover:brightness-110 active:brightness-95",
              "disabled:opacity-60 disabled:cursor-not-allowed",
              "ring-1 ring-purple-200/60",
            ].join(" ")}
          >
            {status === "connecting"
              ? "Starting WebRTC…"
              : callStatus === "calling"
              ? "Calling via Twilio…"
              : mode === "webrtc" && status === "connected"
              ? "Live (WebRTC) ✅"
              : mode === "twilio"
              ? "Live (Twilio fallback) ✅"
              : "Start"}
          </button>

          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
            <span>
              Mode: <span className="text-white">{mode === "idle" ? "—" : mode.toUpperCase()}</span>
            </span>
            <Link href="/mobile/profile" className="underline text-slate-200">
              Profile
            </Link>
          </div>

          {mode === "twilio" && (
            <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
              <p className="text-xs text-slate-200 font-medium">
                Twilio fallback is limited to ~5 minutes
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                After that, we’ll continue in chat to control costs. (M18 coaching refinement is postponed.)
              </p>

              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-slate-300">
                  Time left: <span className="font-mono text-white">{fmtCountdown(twilioSecondsLeft)}</span>
                </span>

                <Link href="/mobile/chat" className="text-xs underline text-slate-200">
                  Open chat now →
                </Link>
              </div>
            </div>
          )}

          <div className="mt-2 text-[11px] text-slate-400">
            Saved phone: <span className="text-slate-200">{profilePhone ? profilePhone : "No phone saved"}</span>
          </div>

          {callError && (
            <p className="mt-2 text-xs text-amber-200">
              {callError}{" "}
              <Link href="/mobile/profile" className="underline text-white">
                Open Profile
              </Link>
            </p>
          )}

          {error && <p className="mt-2 text-xs text-amber-200">WebRTC error: {error}</p>}
        </div>

        <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
          <p className="text-sm font-semibold">Call a contact</p>
          <p className="text-xs text-slate-400 mt-1">
            Choose a saved contact (Profile → Contacts), confirm, then we place the call.
          </p>

          {contactsLoading ? (
            <p className="text-xs text-slate-400 mt-2">Loading contacts…</p>
          ) : contactsError ? (
            <p className="text-xs text-amber-200 mt-2">{contactsError}</p>
          ) : contacts.length === 0 ? (
            <p className="text-xs text-slate-400 mt-2">
              No contacts saved yet. Add one in{" "}
              <Link className="underline text-slate-200" href="/mobile/profile">
                Profile
              </Link>
              .
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              <label className="text-[11px] text-slate-400">Select contact</label>
              <select
                value={selectedContactId}
                onChange={(e) => setSelectedContactId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none"
              >
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.phone}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={requestCallSelectedContact}
                className="w-full mt-2 px-4 py-2 rounded-full bg-purple-600 text-sm font-semibold text-white hover:bg-purple-500"
              >
                Call selected contact
              </button>

              {callContactError && (
                <p className="text-[11px] text-amber-200">{callContactError}</p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMute}
            disabled={status !== "connected" || mode !== "webrtc"}
            className="flex-1 px-4 py-2 rounded-full bg-slate-800 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {muted ? "Unmute" : "Mute"}
          </button>

          <button
            type="button"
            onClick={endWebRTC}
            disabled={status !== "connected" || mode !== "webrtc"}
            className="flex-1 px-4 py-2 rounded-full bg-rose-600 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            End WebRTC
          </button>
        </div>

        <audio ref={remoteAudioRef} autoPlay playsInline />

        <div className="mt-3 p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Realtime events</h2>
            <span className="text-[10px] text-slate-400">{status}</span>
          </div>

          {events.length === 0 ? (
            <p className="text-xs text-slate-400 mt-2">No events yet. Press Start to begin.</p>
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
          Tip: WebRTC transcripts are saved back into chat via transcripts.
        </div>
      </section>

      {confirmOpen && (
        <div
          className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-40"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-4 space-y-3 border border-slate-200 text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold">Confirm call</p>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Close
              </button>
            </div>

            <p className="text-sm text-slate-700">
              Call{" "}
              <span className="font-semibold">{selectedContact?.name ?? "this contact"}</span>{" "}
              at <span className="font-mono">{selectedContact?.phone ?? ""}</span>?
            </p>

            {callContactError && (
              <p className="text-[11px] text-amber-600">{callContactError}</p>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={confirming}
                className="flex-1 px-4 py-2 rounded-full bg-slate-100 text-sm font-medium border border-slate-200 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmCallSelectedContact}
                disabled={confirming}
                className="flex-1 px-4 py-2 rounded-full bg-purple-600 text-sm font-semibold text-white disabled:opacity-60"
              >
                {confirming ? "Calling…" : "Confirm call"}
              </button>
            </div>

            <p className="text-[11px] text-slate-500">
              Tip: Save/edit contacts in Profile → Contacts.
            </p>
          </div>
        </div>
      )}

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
