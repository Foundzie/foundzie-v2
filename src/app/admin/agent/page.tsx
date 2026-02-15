"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  source?: string;
  tags?: string[];
  interactionMode?: "normal" | "child";
};

type AgentDebug = {
  systemPromptPreview?: string;
  mode?: "stub" | "openai" | "error";
  hasKey?: boolean;
  rawError?: string;
  toolResults?: Array<{ name: string; result: unknown }>;
};

type AgentReplyPayload = {
  ok: boolean;
  agentReply: string;
  usedTools?: string[];
  debug?: AgentDebug;
  systemPromptPreview?: string;
  availableTools?: string[];
  implementedTools?: string[];
};

type HistoryItem = {
  id: string;
  role: "admin" | "foundzie";
  text: string;
  usedTools?: string[];
  debugMode?: string;
};

function formatTools(tools?: string[]) {
  if (!tools || tools.length === 0) return "none";
  return tools.join(", ");
}

export default function AdminAgentPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [input, setInput] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [roomId, setRoomId] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [lastDebug, setLastDebug] = useState<AgentDebug | null>(null);
  const [availableTools, setAvailableTools] = useState<string[]>([]);
  const [implementedTools, setImplementedTools] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  // ✅ M21.6 Brain Console: diagnostics panel state
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagError, setDiagError] = useState<string | null>(null);
  const [diagJson, setDiagJson] = useState<any>(null);

  // -------- Load users so you can ask "about" someone ----------

  useEffect(() => {
    async function loadUsers() {
      try {
        setLoadingUsers(true);
        const res = await fetch("/api/users", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load users");
        const data = await res.json();
        const items: AdminUser[] = Array.isArray(data.items) ? data.items : [];
        setUsers(items);
      } catch (err) {
        console.error("[admin/agent] failed to load users", err);
      } finally {
        setLoadingUsers(false);
      }
    }

    loadUsers();
  }, []);

  // -------- M21.6: Load system diagnostics (safe proxy) ----------
  async function loadDiagnostics() {
    setDiagError(null);
    setDiagLoading(true);
    try {
      const res = await fetch("/api/admin/diag", { cache: "no-store" });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Diag failed (${res.status})`);
      }
      const data = await res.json();
      setDiagJson(data);
    } catch (e: any) {
      setDiagError(e?.message || "Failed to load diagnostics.");
      setDiagJson(null);
    } finally {
      setDiagLoading(false);
    }
  }

  async function copyDiagnostics() {
    try {
      const text = JSON.stringify(diagJson ?? { note: "No diagnostics loaded" }, null, 2);
      await navigator.clipboard.writeText(text);
      alert("Diagnostics copied.");
    } catch {
      alert("Could not copy (clipboard blocked).");
    }
  }

  // -------- Handle Ask Foundzie submit ----------

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    setSending(true);
    setError(null);

    const adminItem: HistoryItem = {
      id: `msg-${Date.now()}-admin`,
      role: "admin",
      text: trimmed,
    };
    setHistory((prev) => [...prev, adminItem]);

    try {
      const body: any = {
        input: trimmed,
        source: "admin",
        toolsMode: "debug",
      };

      if (selectedUserId) body.userId = selectedUserId;
      if (roomId.trim()) body.roomId = roomId.trim();

      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Agent HTTP ${res.status} – ${res.statusText} – ${text}`
        );
      }

      const data = (await res.json()) as AgentReplyPayload;

      const replyText =
        data.agentReply?.trim() ||
        "Foundzie: I received your request but my reply was empty.";

      const foundzieItem: HistoryItem = {
        id: `msg-${Date.now()}-foundzie`,
        role: "foundzie",
        text: replyText,
        usedTools: data.usedTools ?? [],
        debugMode: data.debug?.mode,
      };

      setHistory((prev) => [...prev, foundzieItem]);
      setLastDebug(data.debug ?? null);
      setAvailableTools(data.availableTools ?? []);
      setImplementedTools(data.implementedTools ?? []);
      setInput("");
    } catch (err: any) {
      console.error("[admin/agent] failed to call /api/agent", err);
      setError(
        err?.message ||
          "Something went wrong talking to Foundzie. Please try again."
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-6 py-6">
      <header className="mb-6 flex items-center justify-between max-w-5xl mx-auto">
        <div>
          <h1 className="text-xl font-semibold text-white">
            Ask Foundzie (Admin Concierge Brain)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Talk to Foundzie about users, SOS, calls, and notifications — with
            tools enabled in debug mode.
          </p>
        </div>

        <Link
          href="/admin"
          className="text-xs text-slate-400 hover:text-slate-200 underline"
        >
          ← back to admin
        </Link>
      </header>

      <section className="max-w-5xl mx-auto grid gap-6 lg:grid-cols-[2fr,1.4fr]">
        {/* LEFT: Chat / prompt area */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl flex flex-col min-h-[420px] shadow-lg">
          {/* Controls */}
          <div className="border-b border-slate-800 px-4 py-3 space-y-3">
            <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
              <div className="flex-1">
                <p className="text-xs text-slate-300">
                  👂 <span className="font-medium">Context</span> (optional)
                </p>
                <p className="text-[11px] text-slate-500">
                  Choose a user or room so Foundzie can answer with more
                  context. You can leave both empty for general questions.
                </p>
              </div>

              <div className="flex flex-col gap-2 md:w-[260px]">
                <label className="text-[11px] text-slate-400">
                  User context
                </label>
                <select
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs outline-none focus:border-purple-400"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  disabled={loadingUsers}
                >
                  <option value="">
                    {loadingUsers ? "Loading users..." : "No user selected"}
                  </option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
              <div className="flex flex-col gap-2 md:w-[260px]">
                <label className="text-[11px] text-slate-400">
                  Room ID (optional)
                </label>
                <input
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs outline-none focus:border-purple-400"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder="e.g. demo-visitor-1 or user-3"
                />
              </div>

              <div className="flex-1 text-right text-[11px] text-slate-500 mt-1 md:mt-5">
                Tools mode: <span className="text-emerald-400">debug</span>{" "}
                (SOS, call log, notifications)
              </div>
            </div>
          </div>

          {/* History */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 text-sm">
            {history.length === 0 && (
              <p className="text-xs text-slate-500">
                Start by asking something like:
                <br />
                <span className="italic text-slate-300">
                  “Summarize the latest SOS cases and suggest what I should do
                  next as concierge.”
                </span>
                <br />
                or
                <br />
                <span className="italic text-slate-300">
                  “For this user, propose a friendly follow-up message and log a
                  call if needed.”
                </span>
              </p>
            )}

            {history.map((item) => (
              <div
                key={item.id}
                className={`flex ${
                  item.role === "admin" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                    item.role === "admin"
                      ? "bg-purple-600 text-white rounded-br-sm"
                      : "bg-slate-800 text-slate-50 rounded-bl-sm"
                  }`}
                >
                  <p className="font-semibold mb-0.5 text-[11px] opacity-80">
                    {item.role === "admin" ? "You (Admin)" : "Foundzie"}
                  </p>
                  <p>{item.text}</p>

                  {item.role === "foundzie" && (
                    <p className="mt-1 text-[10px] opacity-70">
                      Tools used: {formatTools(item.usedTools)}
                      {item.debugMode && ` • mode: ${item.debugMode}`}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="border-t border-slate-800 px-4 py-3 flex gap-2 items-center bg-slate-900/80 rounded-b-2xl"
          >
            <input
              className="flex-1 rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-sm outline-none focus:border-purple-400"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Foundzie something… (e.g. 'Draft a follow-up for this user about nightlife in Chicago')"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="rounded-full bg-purple-600 px-4 py-2 text-xs font-medium text-white disabled:opacity-60"
            >
              {sending ? "Asking…" : "Ask Foundzie"}
            </button>
          </form>

          {error && (
            <p className="px-4 py-2 text-[11px] text-red-400 border-t border-slate-800 bg-slate-950">
              {error}
            </p>
          )}
        </div>

        {/* RIGHT: Brain + Debug + tools summary */}
        <aside className="space-y-4">
          {/* ✅ NEW: Foundzie Brain panel */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 text-xs shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[13px] font-semibold text-slate-100">
                Foundzie Brain — System Status
              </h2>
              <button
                type="button"
                onClick={loadDiagnostics}
                className="text-[11px] text-emerald-300 underline"
                disabled={diagLoading}
              >
                {diagLoading ? "Loading..." : "Load"}
              </button>
            </div>

            <p className="text-[11px] text-slate-400">
              This pulls live diagnostics via <code>/api/admin/diag</code> (owner-only).
            </p>

            {diagError && (
              <p className="mt-2 text-[11px] text-red-400">Error: {diagError}</p>
            )}

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={copyDiagnostics}
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-[11px] text-slate-200"
                disabled={!diagJson}
              >
                Copy diagnostics
              </button>

              <div className="text-[11px] text-slate-500 self-center">
                Smoke: <code>npm run smoke</code>
              </div>
            </div>

            <pre className="mt-3 text-[10px] text-slate-300 bg-slate-950 rounded-md p-2 max-h-56 overflow-auto whitespace-pre-wrap border border-slate-800">
              {diagJson ? JSON.stringify(diagJson, null, 2) : "No diagnostics loaded yet."}
            </pre>
          </div>

          {/* Existing debug panel */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 text-xs shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[13px] font-semibold text-slate-100">
                Agent Tools & Status
              </h2>
              <button
                type="button"
                onClick={() => setShowDebug((v) => !v)}
                className="text-[11px] text-purple-300 underline"
              >
                {showDebug ? "Hide debug" : "Show debug"}
              </button>
            </div>

            <div className="space-y-2">
              <div>
                <p className="font-semibold text-[11px] text-slate-300">
                  Available tools
                </p>
                <p className="text-[11px] text-slate-400">
                  {availableTools.length
                    ? availableTools.join(", ")
                    : "Not loaded yet. Ask a question first."}
                </p>
              </div>

              <div>
                <p className="font-semibold text-[11px] text-slate-300">
                  Implemented tools
                </p>
                <p className="text-[11px] text-slate-400">
                  {implementedTools.length
                    ? implementedTools.join(", ")
                    : "Not loaded yet. Ask a question first."}
                </p>
              </div>

              {lastDebug && (
                <div className="mt-2">
                  <p className="font-semibold text-[11px] text-slate-300">
                    Last agent run
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Mode:{" "}
                    <span className="text-emerald-400">
                      {lastDebug.mode ?? "unknown"}
                    </span>{" "}
                    • Has key:{" "}
                    <span className="text-emerald-400">
                      {String(lastDebug.hasKey ?? false)}
                    </span>
                  </p>
                  {lastDebug.rawError && (
                    <p className="text-[11px] text-red-400 mt-1">
                      Error: {lastDebug.rawError}
                    </p>
                  )}
                </div>
              )}
            </div>

            {showDebug && lastDebug?.systemPromptPreview && (
              <div className="mt-3 border-t border-slate-800 pt-3">
                <p className="font-semibold text-[11px] text-slate-300 mb-1">
                  System prompt preview (first 200 chars)
                </p>
                <pre className="text-[10px] text-slate-400 bg-slate-950 rounded-md p-2 max-h-40 overflow-auto whitespace-pre-wrap">
                  {lastDebug.systemPromptPreview}
                </pre>
              </div>
            )}

            {showDebug && lastDebug?.toolResults && (
              <div className="mt-3 border-t border-slate-800 pt-3">
                <p className="font-semibold text-[11px] text-slate-300 mb-1">
                  Recent tool results
                </p>
                <pre className="text-[10px] text-slate-400 bg-slate-950 rounded-md p-2 max-h-40 overflow-auto whitespace-pre-wrap">
                  {JSON.stringify(lastDebug.toolResults, null, 2)}
                </pre>
              </div>
            )}
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 text-[11px] text-slate-300 shadow-lg">
            <h2 className="text-[13px] font-semibold mb-2 text-slate-100">
              How to use this console
            </h2>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Pick a <span className="font-semibold">User</span> to give
                Foundzie extra context (tags, source, interactionMode).
              </li>
              <li>
                Optionally enter a <span className="font-semibold">roomId</span>{" "}
                if you want it to reason about a specific chat thread.
              </li>
              <li>
                Ask in natural language, like you&apos;re talking to a team
                member.
              </li>
              <li>
                Foundzie will reply in a warm, conversational way — and when
                needed, it can open SOS cases, log calls, or broadcast
                notifications using tools.
              </li>
            </ul>
          </div>
        </aside>
      </section>
    </main>
  );
}
