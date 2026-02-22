import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

type JarvisAction = {
  kind: "create" | "modify";
  path: string;
  goal: string;
  notes?: string;
};

type JarvisPlan = {
  ok: true;
  version: "M21.8";
  prompt: string;
  context: {
    truthFiles: Record<string, any>;
    diag: any | null;
  };
  plan: {
    title: string;
    description: string;
    rationale?: string;
    risks?: string[];
    testPlan?: string[];
    actions: JarvisAction[];
  };
  rawAgent?: {
    usedTools?: string[];
    debugMode?: string;
  };
};

function readTokenFromReq(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const x = req.headers.get("x-admin-token")?.trim() || "";
  const cookie = req.cookies.get("admin_token")?.value?.trim() || "";
  return bearer || x || cookie || "";
}

async function requireOwner(req: NextRequest) {
  const token = readTokenFromReq(req);
  const expected =
    process.env.JARVIS_OWNER_TOKEN ||
    process.env.ADMIN_TOKEN ||
    process.env.FOUNDZIE_ADMIN_TOKEN ||
    "";

  if (!expected) return { ok: false as const, error: "Owner auth not configured (missing env token)." };
  if (!token || token !== expected) return { ok: false as const, error: "Unauthorized" };
  return { ok: true as const };
}

function isAllowedPath(p: string) {
  const s = (p || "").trim();
  if (!s) return false;
  const bad =
    s.startsWith(".env") ||
    s.includes("..") ||
    s.startsWith("/") ||
    s.startsWith("\\") ||
    s.includes("\0");
  if (bad) return false;

  return (
    s.startsWith("src/") ||
    s.startsWith("scripts/") ||
    s.startsWith(".github/workflows/") ||
    s.startsWith(".foundzie/") ||
    s === "package.json"
  );
}

async function safeReadJson(relPath: string) {
  try {
    const abs = path.join(process.cwd(), relPath);
    const txt = await fs.readFile(abs, "utf8");
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

// robust JSON extraction
function safeJsonExtract(text: string): unknown | null {
  const t = (text || "").trim();
  if (!t) return null;

  try {
    return JSON.parse(t);
  } catch {}

  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const candidate = t.slice(start, end + 1);
    try {
      return JSON.parse(candidate);
    } catch {}
  }
  return null;
}

function normalizeActions(raw: any[]): JarvisAction[] {
  const out: JarvisAction[] = [];
  for (const a of raw || []) {
    const kind = String(a?.kind ?? "").trim();
    const p = String(a?.path ?? "").trim();
    const goal = String(a?.goal ?? "").trim();
    const notes = a?.notes ? String(a.notes) : undefined;

    if ((kind !== "create" && kind !== "modify") || !p || !goal) continue;
    if (!isAllowedPath(p)) continue;

    out.push({ kind: kind as any, path: p, goal, notes });
  }
  return out;
}

export async function POST(req: NextRequest) {
  const auth = await requireOwner(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  let body: any = null;
  try { body = await req.json(); } catch {}

  const prompt = String(body?.prompt ?? "").trim();
  if (!prompt) return NextResponse.json({ ok: false, error: "Missing 'prompt'." }, { status: 400 });

  // truth files
  const truthFiles: Record<string, any> = {};
  for (const f of [
    ".foundzie/system-map.json",
    ".foundzie/critical-paths.json",
    ".foundzie/env-contract.json",
    ".foundzie/feature-registry.json",
  ]) {
    const j = await safeReadJson(f);
    if (j !== null) truthFiles[f] = j;
  }

  // diag
  let diag: any = null;
  try {
    const res = await fetch(new URL("/api/admin/diag", req.url), {
      method: "GET",
      headers: {
        authorization: req.headers.get("authorization") || "",
        "x-admin-token": req.headers.get("x-admin-token") || "",
        cookie: req.headers.get("cookie") || "",
      },
      cache: "no-store",
    });
    if (res.ok) diag = await res.json();
  } catch {
    diag = null;
  }

  // PLAN must be SMALL — NO code allowed
  const instruction = `
You are Foundzie Jarvis (M21.8) in PLAN-ONLY mode.

CRITICAL: Output ONLY valid JSON. No markdown. No extra text.
CRITICAL: DO NOT include any code. DO NOT include contentLines. DO NOT include file contents.

Your job:
- Decide what files to create/modify
- Keep it minimal
- Provide high-level goals per file

Schema EXACT:
{
  "version": "M21.8",
  "title": "short PR title",
  "description": "PR description",
  "rationale": "optional",
  "risks": ["optional"],
  "testPlan": ["optional"],
  "actions": [
    { "kind": "create|modify", "path": "src/...", "goal": "what to do in this file", "notes":"optional" }
  ]
}

Rules:
- Allowed paths ONLY: src/, scripts/, .github/workflows/, .foundzie/, package.json
- actions must be 1..6 items
- Prefer creating new small files rather than editing large existing ones
- Never mention or include secrets

CONTEXT.truthFiles:
${JSON.stringify(truthFiles, null, 2)}

CONTEXT.diag:
${JSON.stringify(diag ?? { note: "diag unavailable" }, null, 2)}

OWNER.prompt:
${prompt}
`.trim();

  let agentJson: any = null;
  let agentReplyText = "";
  let usedTools: string[] | undefined;
  let debugMode: string | undefined;

  try {
    const agentRes = await fetch(new URL("/api/agent", req.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: instruction, source: "admin", toolsMode: "debug" }),
    });

    if (!agentRes.ok) {
      const t = await agentRes.text().catch(() => "");
      return NextResponse.json({ ok: false, error: `Agent failed (${agentRes.status})`, details: t }, { status: 500 });
    }

    const payload = await agentRes.json();
    agentReplyText = String(payload?.agentReply ?? "").trim();
    usedTools = payload?.usedTools;
    debugMode = payload?.debug?.mode;

    const parsed = safeJsonExtract(agentReplyText);
    if (!parsed || typeof parsed !== "object") {
      return NextResponse.json({ ok: false, error: "Agent did not return valid JSON plan.", raw: agentReplyText }, { status: 500 });
    }
    agentJson = parsed;
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed to call agent." }, { status: 500 });
  }

  if (agentJson.version !== "M21.8") {
    return NextResponse.json({ ok: false, error: "Invalid plan.version. Expected M21.8.", raw: agentJson }, { status: 500 });
  }
  if (!agentJson.title || !agentJson.description || !Array.isArray(agentJson.actions)) {
    return NextResponse.json({ ok: false, error: "Invalid plan schema (missing title/description/actions).", raw: agentJson }, { status: 500 });
  }

  const actions = normalizeActions(agentJson.actions);
  if (actions.length < 1 || actions.length > 6) {
    return NextResponse.json({ ok: false, error: `actions must be 1..6 items. Got ${actions.length}.`, raw: agentJson }, { status: 500 });
  }

  const out: JarvisPlan = {
    ok: true,
    version: "M21.8",
    prompt,
    context: { truthFiles, diag },
    plan: {
      title: String(agentJson.title),
      description: String(agentJson.description),
      rationale: agentJson.rationale ? String(agentJson.rationale) : undefined,
      risks: Array.isArray(agentJson.risks) ? agentJson.risks.map(String) : undefined,
      testPlan: Array.isArray(agentJson.testPlan) ? agentJson.testPlan.map(String) : undefined,
      actions,
    },
    rawAgent: { usedTools, debugMode },
  };

  return NextResponse.json(out);
}