"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
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

type PullItem = {
  number: number;
  title: string;
  state: string;
  merged: boolean;
  draft: boolean;
  updatedAt: string;
  htmlUrl: string;
  headSha?: string;
  headRef?: string;
  baseRef?: string;
  user?: string;
};

type PullDetails = {
  ok: boolean;
  pr: {
    number: number;
    title: string;
    htmlUrl: string;
    state: string;
    merged: boolean;
    headSha: string;
    headRef?: string;
    baseRef?: string;
  };
  checks: Array<{
    name: string;
    status: string;
    conclusion: string | null;
    detailsUrl?: string;
    startedAt?: string;
    completedAt?: string;
  }>;
  previewUrl: string | null;
};

type CreatePrFile = {
  path: string;
  content: string;
};

type CreatePrResponse =
  | { ok: true; number: number; url: string; branch: string; base: string }
  | { ok: false; error: string; reason?: string; details?: unknown };

function formatTools(tools?: string[]) {
  if (!tools || tools.length === 0) return "none";
  return tools.join(", ");
}

function fmtTime(s?: string) {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString();
}

// Client-side UX check only (server still enforces the real allowlist)
function isAllowedPath(p: string) {
  const path = (p || "").trim();
  if (!path) return false;
  const bad =
    path.startsWith(".env") ||
    path.includes("..") ||
    path.startsWith("/") ||
    path.startsWith("\\") ||
    path.includes("\0");
  if (bad) return false;

  return (
    path.startsWith("src/") ||
    path.startsWith("scripts/") ||
    path.startsWith(".github/workflows/") ||
    path === "package.json"
  );
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

  // ✅ M21.7b: GitHub PRs panel state
  const [prsLoading, setPrsLoading] = useState(false);
  const [prsError, setPrsError] = useState<string | null>(null);
  const [prs, setPrs] = useState<PullItem[]>([]);
  const [selectedPr, setSelectedPr] = useState<number | null>(null);

  const [prDetailsLoading, setPrDetailsLoading] = useState(false);
  const [prDetailsError, setPrDetailsError] = useState<string | null>(null);
  const [prDetails, setPrDetails] = useState<PullDetails | null>(null);

  // ✅ M21.7c.1: Create PR UI state
  const [createTitle, setCreateTitle] = useState("Autopilot: change request");
  const [createDescription, setCreateDescription] = useState(
    "Created by Foundzie Brain (PR-only)."
  );
  const [createBase, setCreateBase] = useState("main");
  const [createBranch, setCreateBranch] = useState("");
  const [createCommitMessage, setCreateCommitMessage] = useState("");
  const [createFiles, setCreateFiles] = useState<CreatePrFile[]>([
    { path: "src/app/api/diag/README-autopilot.txt", content: "hello from autopilot" },
  ]);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createResp, setCreateResp] = useState<CreatePrResponse | null>(null);

  const hasInvalidPaths = useMemo(() => {
    return createFiles.some((f) => !isAllowedPath(f.path));
  }, [createFiles]);

  const hasEmptyFile = useMemo(() => {
    return createFiles.some((f) => !f.path.trim() || !f.content);
  }, [createFiles]);

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

  // -------- M21.7b: Load PR list ----------
  async function loadPrs() {
    setPrsError(null);
    setPrsLoading(true);
    try {
      const res = await fetch("/api/admin/github/pulls", { cache: "no-store" });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `PR list failed (${res.status})`);
      }
      const data = await res.json();
      const items: PullItem[] = Array.isArray(data.items) ? data.items : [];
      setPrs(items);
    } catch (e: any) {
      setPrsError(e?.message || "Failed to load PRs.");
      setPrs([]);
    } finally {
      setPrsLoading(false);
    }
  }

  // -------- M21.7b: Load PR details + checks ----------
  async function loadPrDetails(prNumber: number) {
    setSelectedPr(prNumber);
    setPrDetails(null);
    setPrDetailsError(null);
    setPrDetailsLoading(true);
    try {
      const res = await fetch(`/api/admin/github/pulls/${prNumber}`, { cache: "no-store" });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `PR details failed (${res.status})`);
      }
      const data = (await res.json()) as PullDetails;
      setPrDetails(data);
    } catch (e: any) {
      setPrDetailsError(e?.message || "Failed to load PR details.");
      setPrDetails(null);
    } finally {
      setPrDetailsLoading(false);
    }
  }

  async function copyPrDetails() {
    try {
      const text = JSON.stringify(prDetails ?? { note: "No PR details loaded" }, null, 2);
      await navigator.clipboard.writeText(text);
      alert("PR details copied.");
    } catch {
      alert("Could not copy (clipboard blocked).");
    }
  }

  // -------- M21.7c.1: Create PR (UI) ----------
  function addFileRow() {
    setCreateFiles((prev) => [...prev, { path: "src/", content: "" }]);
  }

  function removeFileRow(idx: number) {
    setCreateFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateFileRow(idx: number, patch: Partial<CreatePrFile>) {
    setCreateFiles((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, ...patch } : f))
    );
  }

  async function createPrFromUi() {
    setCreateError(null);
    setCreateResp(null);

    const title = createTitle.trim();
    const base = createBase.trim() || "main";
    const files = createFiles.map((f) => ({ path: f.path.trim(), content: f.content ?? "" }));

    if (!title) {
      setCreateError("Title is required.");
      return;
    }
    if (files.length === 0) {
      setCreateError("Add at least one file change.");
      return;
    }
    if (hasEmptyFile) {
      setCreateError("Each file needs a path and content.");
      return;
    }
    if (hasInvalidPaths) {
      setCreateError(
        "One or more file paths are not allowed. Allowed: src/, scripts/, .github/workflows/, package.json (no .., no absolute paths, no .env)."
      );
      return;
    }

    setCreateBusy(true);
    try {
      const payload: any = {
        title,
        description: createDescription.trim() || undefined,
        base,
        files,
      };

      const branch = createBranch.trim();
      if (branch) payload.branch = branch;

      const commitMessage = createCommitMessage.trim();
      if (commitMessage) payload.commitMessage = commitMessage;

      const res = await fetch("/api/admin/github/create-pr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await res.json().catch(() => null)) as any;

      if (!res.ok || !json) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Create PR failed (${res.status})`);
      }

      setCreateResp(json as CreatePrResponse);

      if ((json as any)?.ok) {
        // refresh PR list automatically so you see it immediately
        await loadPrs();
      }
    } catch (e: any) {
      setCreateError(e?.message || "Failed to create PR.");
    } finally {
      setCreateBusy(false);
    }
  }

  async function copyCreatePrResult() {
    try {
      const text = JSON.stringify(createResp ?? { note: "No PR result yet" }, null, 2);
      await navigator.clipboard.writeText(text);
      alert("Result copied.");
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
        throw new Error(`Agent HTTP ${res.status} – ${res.statusText} – ${text}`);
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
      setError(err?.message || "Something went wrong talking to Foundzie. Please try again.");
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
            Talk to Foundzie about users, SOS, calls, and notifications — with tools enabled in debug mode.
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
                  Choose a user or room so Foundzie can answer with more context. You can leave both empty for general questions.
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
                Tools mode: <span className="text-emerald-400">debug</span> (SOS, call log, notifications)
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
                  “Summarize the latest SOS cases and suggest what I should do next as concierge.”
                </span>
                <br />
                or
                <br />
                <span className="italic text-slate-300">
                  “For this user, propose a friendly follow-up message and log a call if needed.”
                </span>
              </p>
            )}

            {history.map((item) => (
              <div
                key={item.id}
                className={`flex ${item.role === "admin" ? "justify-end" : "justify-start"}`}
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

        {/* RIGHT: Brain + PRs + Create PR + Debug */}
        <aside className="space-y-4">
          {/* ✅ M21.7b: Autopilot PRs panel */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 text-xs shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[13px] font-semibold text-slate-100">
                Autopilot — PRs & Checks
              </h2>
              <button
                type="button"
                onClick={loadPrs}
                className="text-[11px] text-emerald-300 underline"
                disabled={prsLoading}
              >
                {prsLoading ? "Loading..." : "Load PRs"}
              </button>
            </div>

            <p className="text-[11px] text-slate-400">
              Owner-only GitHub view via <code>/api/admin/github/*</code>. Env:
              <code> GITHUB_TOKEN</code>, <code> GITHUB_OWNER</code>, <code> GITHUB_REPO</code>.
            </p>

            {prsError && <p className="mt-2 text-[11px] text-red-400">Error: {prsError}</p>}

            <div className="mt-3 grid gap-2">
              {prs.length === 0 ? (
                <div className="text-[11px] text-slate-500">No PRs loaded yet.</div>
              ) : (
                <div className="max-h-44 overflow-auto border border-slate-800 rounded-md bg-slate-950">
                  {prs.map((p) => (
                    <button
                      key={p.number}
                      type="button"
                      onClick={() => loadPrDetails(p.number)}
                      className={`w-full text-left px-3 py-2 border-b border-slate-900 hover:bg-slate-900/60 ${
                        selectedPr === p.number ? "bg-slate-900/60" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[11px] text-slate-200 font-semibold truncate">
                          #{p.number} {p.title}
                        </div>
                        <div className="text-[10px] text-slate-500 whitespace-nowrap">
                          {p.merged ? "merged" : p.state}
                          {p.draft ? " • draft" : ""}
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        updated: {fmtTime(p.updatedAt)} {p.user ? `• by ${p.user}` : ""}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* PR details */}
            <div className="mt-3">
              {prDetailsError && (
                <p className="text-[11px] text-red-400">Error: {prDetailsError}</p>
              )}

              {prDetailsLoading && (
                <p className="text-[11px] text-slate-400">Loading PR checks…</p>
              )}

              {prDetails?.ok && (
                <div className="mt-2 border border-slate-800 rounded-md bg-slate-950 p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] text-slate-200 font-semibold truncate">
                        #{prDetails.pr.number} {prDetails.pr.title}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        state: {prDetails.pr.merged ? "merged" : prDetails.pr.state} • head:{" "}
                        <code>{prDetails.pr.headRef}</code>
                      </div>
                    </div>

                    <a
                      href={prDetails.pr.htmlUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-purple-300 underline whitespace-nowrap"
                    >
                      Open PR
                    </a>
                  </div>

                  <div className="mt-2 flex gap-2 items-center">
                    {prDetails.previewUrl ? (
                      <a
                        href={prDetails.previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-emerald-300 underline"
                      >
                        Open Preview
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-500">
                        Preview URL: not detected yet
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={copyPrDetails}
                      className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-200"
                    >
                      Copy
                    </button>
                  </div>

                  <div className="mt-2">
                    <p className="text-[11px] font-semibold text-slate-300 mb-1">Checks</p>
                    {prDetails.checks.length === 0 ? (
                      <p className="text-[11px] text-slate-500">No check-runs found.</p>
                    ) : (
                      <div className="max-h-40 overflow-auto border border-slate-800 rounded-md">
                        {prDetails.checks.map((c, idx) => (
                          <div key={`${c.name}-${idx}`} className="px-3 py-2 border-b border-slate-900">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[11px] text-slate-200 font-semibold truncate">
                                {c.name}
                              </div>
                              <div className="text-[10px] text-slate-500 whitespace-nowrap">
                                {c.status}
                                {c.conclusion ? ` • ${c.conclusion}` : ""}
                              </div>
                            </div>
                            {c.detailsUrl && (
                              <a
                                href={c.detailsUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-slate-400 underline break-all"
                              >
                                {c.detailsUrl}
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ✅ M21.7c.1: Create PR UI */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 text-xs shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[13px] font-semibold text-slate-100">
                Autopilot — Create PR (PR-only)
              </h2>
              <button
                type="button"
                onClick={createPrFromUi}
                disabled={createBusy}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60"
                title="Creates a PR only. Never auto-merges."
              >
                {createBusy ? "Creating…" : "Create PR"}
              </button>
            </div>

            <p className="text-[11px] text-slate-400">
              Uses <code>/api/admin/github/create-pr</code>. Requires env:
              <code> GITHUB_AUTOPILOT_TOKEN</code> + owner/repo. Paths are allowlisted.
            </p>

            {createError && (
              <p className="mt-2 text-[11px] text-red-400">Error: {createError}</p>
            )}

            <div className="mt-3 grid gap-2">
              <label className="text-[11px] text-slate-400">Title</label>
              <input
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs outline-none focus:border-emerald-400"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder="e.g. Fix diag auth + add PR UI"
              />

              <label className="text-[11px] text-slate-400 mt-1">Description</label>
              <textarea
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs outline-none focus:border-emerald-400 min-h-[60px]"
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                placeholder="What is this PR doing?"
              />

              <div className="grid grid-cols-3 gap-2 mt-1">
                <div>
                  <label className="text-[11px] text-slate-400">Base</label>
                  <input
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs outline-none focus:border-emerald-400"
                    value={createBase}
                    onChange={(e) => setCreateBase(e.target.value)}
                    placeholder="main"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Branch (optional)</label>
                  <input
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs outline-none focus:border-emerald-400"
                    value={createBranch}
                    onChange={(e) => setCreateBranch(e.target.value)}
                    placeholder="autopilot/my-branch"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Commit msg (optional)</label>
                  <input
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs outline-none focus:border-emerald-400"
                    value={createCommitMessage}
                    onChange={(e) => setCreateCommitMessage(e.target.value)}
                    placeholder="Autopilot: ..."
                  />
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <div className="text-[11px] text-slate-300 font-semibold">
                  File changes ({createFiles.length})
                </div>
                <button
                  type="button"
                  onClick={addFileRow}
                  className="text-[11px] text-emerald-300 underline"
                >
                  + Add file
                </button>
              </div>

              <div className="space-y-3">
                {createFiles.map((f, idx) => {
                  const allowed = isAllowedPath(f.path);
                  return (
                    <div key={`file-${idx}`} className="border border-slate-800 rounded-md bg-slate-950 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] text-slate-400">Path</label>
                          <input
                            className={`w-full rounded-md border px-2 py-1 text-xs outline-none ${
                              allowed
                                ? "border-slate-700 bg-slate-950 focus:border-emerald-400"
                                : "border-red-600/60 bg-slate-950 focus:border-red-400"
                            }`}
                            value={f.path}
                            onChange={(e) => updateFileRow(idx, { path: e.target.value })}
                            placeholder="src/..."
                          />
                          {!allowed && f.path.trim() && (
                            <p className="mt-1 text-[10px] text-red-400">
                              Path not allowed. Allowed: src/, scripts/, .github/workflows/, package.json
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => removeFileRow(idx)}
                          disabled={createFiles.length === 1}
                          className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-200 disabled:opacity-60"
                          title={createFiles.length === 1 ? "At least one file is required." : "Remove file"}
                        >
                          Remove
                        </button>
                      </div>

                      <div className="mt-2">
                        <label className="text-[10px] text-slate-400">Content</label>
                        <textarea
                          className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-xs outline-none focus:border-emerald-400 min-h-[90px]"
                          value={f.content}
                          onChange={(e) => updateFileRow(idx, { content: e.target.value })}
                          placeholder="Paste full file contents here."
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {(hasInvalidPaths || hasEmptyFile) && (
                <p className="text-[11px] text-slate-400">
                  Note: Fix invalid paths / missing fields to enable a clean PR run.
                </p>
              )}

              {createResp && (
                <div className="mt-2 border border-slate-800 rounded-md bg-slate-950 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] text-slate-200 font-semibold">
                      Result
                    </div>
                    <button
                      type="button"
                      onClick={copyCreatePrResult}
                      className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-200"
                    >
                      Copy
                    </button>
                  </div>

                  {"ok" in createResp && createResp.ok ? (
                    <div className="mt-2 text-[11px] text-slate-300 space-y-1">
                      <div>
                        ✅ PR created:{" "}
                        <a
                          className="text-emerald-300 underline"
                          href={createResp.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          #{createResp.number}
                        </a>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        base: <code>{createResp.base}</code> • branch:{" "}
                        <code>{createResp.branch}</code>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 text-[11px] text-red-300">
                      ❌ {(createResp as any).error}
                      {(createResp as any).reason ? ` — ${(createResp as any).reason}` : ""}
                    </div>
                  )}

                  <pre className="mt-2 text-[10px] text-slate-300 whitespace-pre-wrap max-h-36 overflow-auto border border-slate-800 rounded-md p-2">
                    {JSON.stringify(createResp, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* ✅ Existing: Foundzie Brain panel */}
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
                Pick a <span className="font-semibold">User</span> to give Foundzie extra context (tags, source, interactionMode).
              </li>
              <li>
                Optionally enter a <span className="font-semibold">roomId</span> if you want it to reason about a specific chat thread.
              </li>
              <li>Ask in natural language, like you&apos;re talking to a team member.</li>
              <li>
                Foundzie will reply in a warm, conversational way — and when needed, it can open SOS cases, log calls, or broadcast notifications using tools.
              </li>
              <li>
                Autopilot can now create PRs directly — still <span className="font-semibold">PR-only</span> (never auto-merge).
              </li>
            </ul>
          </div>
        </aside>
      </section>
    </main>
  );
}