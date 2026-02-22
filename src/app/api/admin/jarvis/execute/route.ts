import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

type JarvisAction = {
  kind: "create" | "modify";
  path: string;
  goal: string;
  notes?: string;
};

type PatchOp =
  | { op: "insertAfter"; anchor: string; insertLines: string[]; note?: string }
  | { op: "insertBefore"; anchor: string; insertLines: string[]; note?: string }
  | { op: "replaceRegex"; pattern: string; flags?: string; replacementLines: string[]; note?: string };

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

async function readFileIfExists(relPath: string) {
  const abs = path.join(process.cwd(), relPath);
  try {
    return await fs.readFile(abs, "utf8");
  } catch {
    return null;
  }
}

// robust JSON extraction (handles extra text before/after)
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

function applyInsertAfter(src: string, anchor: string, insertLines: string[]) {
  const idx = src.indexOf(anchor);
  if (idx < 0) throw new Error(`Anchor not found (insertAfter): ${anchor}`);
  const after = idx + anchor.length;
  const insert = "\n" + insertLines.join("\n");
  return src.slice(0, after) + insert + src.slice(after);
}

function applyInsertBefore(src: string, anchor: string, insertLines: string[]) {
  const idx = src.indexOf(anchor);
  if (idx < 0) throw new Error(`Anchor not found (insertBefore): ${anchor}`);
  const insert = insertLines.join("\n") + "\n";
  return src.slice(0, idx) + insert + src.slice(idx);
}

function applyReplaceRegex(src: string, pattern: string, flags: string | undefined, replacementLines: string[]) {
  const re = new RegExp(pattern, flags || "");
  if (!re.test(src)) throw new Error(`Regex did not match: /${pattern}/${flags || ""}`);
  return src.replace(re, replacementLines.join("\n"));
}

function normalizePatchOps(raw: any[]): PatchOp[] {
  const ops: PatchOp[] = [];
  for (const r of raw || []) {
    const op = String(r?.op ?? "").trim();
    if (op === "insertAfter") {
      ops.push({
        op: "insertAfter",
        anchor: String(r?.anchor ?? ""),
        insertLines: Array.isArray(r?.insertLines) ? r.insertLines.map((x: any) => String(x)) : [],
        note: r?.note ? String(r.note) : undefined,
      });
    } else if (op === "insertBefore") {
      ops.push({
        op: "insertBefore",
        anchor: String(r?.anchor ?? ""),
        insertLines: Array.isArray(r?.insertLines) ? r.insertLines.map((x: any) => String(x)) : [],
        note: r?.note ? String(r.note) : undefined,
      });
    } else if (op === "replaceRegex") {
      ops.push({
        op: "replaceRegex",
        pattern: String(r?.pattern ?? ""),
        flags: r?.flags ? String(r.flags) : undefined,
        replacementLines: Array.isArray(r?.replacementLines) ? r.replacementLines.map((x: any) => String(x)) : [],
        note: r?.note ? String(r.note) : undefined,
      });
    }
  }
  return ops.filter((o) => {
    if (o.op === "replaceRegex") return !!o.pattern && o.replacementLines.length > 0;
    return !!(o as any).anchor && (o as any).insertLines?.length > 0;
  });
}

// HARD LIMITS to prevent truncation (this is the key fix)
function validateMicroOps(ops: PatchOp[]) {
  // keep ops count tiny
  if (ops.length < 1 || ops.length > 3) {
    return { ok: false as const, error: `ops must be 1..3 (micro). Got ${ops.length}.` };
  }

  // prevent giant JSX blocks in ops
  const MAX_LINES_PER_OP = 12;
  const MAX_CHARS_PER_OP = 900;

  for (const op of ops) {
    const lines =
      op.op === "replaceRegex"
        ? op.replacementLines
        : (op as any).insertLines;

    if (!Array.isArray(lines) || lines.length < 1) {
      return { ok: false as const, error: `Each op must include non-empty lines.` };
    }
    if (lines.length > MAX_LINES_PER_OP) {
      return { ok: false as const, error: `Too many lines in an op (${lines.length}). Max ${MAX_LINES_PER_OP}.` };
    }
    const joined = lines.join("\n");
    if (joined.length > MAX_CHARS_PER_OP) {
      return { ok: false as const, error: `Op too large (${joined.length} chars). Max ${MAX_CHARS_PER_OP}.` };
    }

    // Strongly discourage returning large JSX fragments
    if (joined.includes("<div") || joined.includes("<p") || joined.includes("className=")) {
      return {
        ok: false as const,
        error:
          "Op contains JSX markup. Must be micro-edits only (import line + component usage), no big JSX blocks.",
      };
    }
  }

  return { ok: true as const };
}

async function callAgent(req: NextRequest, input: string) {
  const agentRes = await fetch(new URL("/api/agent", req.url), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input, source: "admin", toolsMode: "debug" }),
  });

  if (!agentRes.ok) {
    const t = await agentRes.text().catch(() => "");
    return { ok: false as const, status: agentRes.status, text: t };
  }

  const payload = await agentRes.json().catch(() => null);
  const agentReplyText = String(payload?.agentReply ?? "").trim();
  return { ok: true as const, agentReplyText };
}

export async function POST(req: NextRequest) {
  const auth = await requireOwner(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  let body: any = null;
  try {
    body = await req.json();
  } catch {}

  const plan = body?.plan;
  if (!plan || typeof plan !== "object") {
    return NextResponse.json({ ok: false, error: "Missing 'plan' object." }, { status: 400 });
  }

  const title = String(plan?.title ?? "").trim();
  const description = String(plan?.description ?? "").trim();
  const base = String(body?.base ?? "main").trim() || "main";
  const actions: JarvisAction[] = Array.isArray(plan?.actions) ? plan.actions : [];

  if (!title || !description) {
    return NextResponse.json({ ok: false, error: "Plan must include title + description." }, { status: 400 });
  }
  if (actions.length < 1 || actions.length > 6) {
    return NextResponse.json(
      { ok: false, error: `actions must be 1..6 items. Got ${actions.length}.` },
      { status: 400 }
    );
  }

  const files: Array<{ path: string; content: string }> = [];

  for (const a of actions) {
    const filePath = String(a?.path ?? "").trim();
    const kind = a?.kind;
    const goal = String(a?.goal ?? "").trim();
    const notes = a?.notes ? String(a.notes) : "";

    if (!filePath || !goal || (kind !== "create" && kind !== "modify")) {
      return NextResponse.json({ ok: false, error: "Invalid action item." }, { status: 400 });
    }
    if (!isAllowedPath(filePath)) {
      return NextResponse.json({ ok: false, error: `Disallowed path: ${filePath}` }, { status: 400 });
    }

    const current = await readFileIfExists(filePath);

    // CREATE (usually small)
    if (kind === "create") {
      if (current && current.trim()) {
        return NextResponse.json(
          { ok: false, error: `Refusing to create existing file: ${filePath}` },
          { status: 400 }
        );
      }

      const instruction = `
You are Foundzie Jarvis (M21.8) in CREATE-FILE mode.

Output ONLY valid JSON. No markdown. No extra text.

Schema EXACT:
{
  "path": "${filePath}",
  "contentLines": ["line1","line2","..."]
}

Rules:
- Never include secrets.
- Keep file reasonably sized (prefer < 200 lines).
- Use minimal imports; do not invent missing modules.
- Implement exactly what the goal asks, nothing extra.

GOAL:
${goal}

NOTES:
${notes}
`.trim();

      const r = await callAgent(req, instruction);
      if (!r.ok) {
        return NextResponse.json(
          { ok: false, error: `Agent failed for create ${filePath} (${r.status})`, details: r.text },
          { status: 500 }
        );
      }

      const parsed = safeJsonExtract(r.agentReplyText);
      if (!parsed || typeof parsed !== "object") {
        return NextResponse.json(
          { ok: false, error: `Agent did not return valid JSON for ${filePath}.`, raw: r.agentReplyText },
          { status: 500 }
        );
      }

      const obj: any = parsed;
      const lines = Array.isArray(obj?.contentLines) ? obj.contentLines.map((x: any) => String(x)) : null;
      if (!lines || lines.length < 1) {
        return NextResponse.json(
          { ok: false, error: `Empty contentLines for ${filePath}.`, raw: obj },
          { status: 500 }
        );
      }

      const content = lines.join("\n");
      if (!content.trim()) {
        return NextResponse.json(
          { ok: false, error: `Generated empty content for ${filePath}.`, raw: obj },
          { status: 500 }
        );
      }
      if (content.length > 70_000) {
        return NextResponse.json(
          { ok: false, error: `File too large (>70k chars): ${filePath}` },
          { status: 400 }
        );
      }

      files.push({ path: filePath, content });
      continue;
    }

    // MODIFY: micro patch only + auto retry
    if (!current || !current.trim()) {
      return NextResponse.json(
        { ok: false, error: `Cannot modify missing/empty file: ${filePath}` },
        { status: 400 }
      );
    }

    const patchInstruction = `
You are Foundzie Jarvis (M21.8) in MODIFY-PATCH mode.

Output ONLY valid JSON. No markdown. No extra text.
DO NOT output full file contents.

Return MICRO patch operations only.
You MUST NOT include large JSX blocks in lines.

Schema EXACT:
{
  "path": "${filePath}",
  "ops": [
    { "op":"insertAfter", "anchor":"exact existing text", "insertLines":["one small line"], "note":"optional" },
    { "op":"insertBefore", "anchor":"exact existing text", "insertLines":["one small line"], "note":"optional" },
    { "op":"replaceRegex", "pattern":"regex", "flags":"optional", "replacementLines":["one small line"], "note":"optional" }
  ]
}

Hard limits:
- ops must be 1..3
- each op lines must be <= 12 lines
- each op total chars must be <= 900 chars
- lines MUST NOT contain <div, <p, className= or big JSX markup
- prefer: add an import line + add a single component usage line
- if UI needs complex markup: create a NEW component file via create actions (small file), and here only insert <ThatComponent />

GOAL:
${goal}

NOTES:
${notes}

CURRENT FILE:
${current}
`.trim();

    // attempt 1
    let r = await callAgent(req, patchInstruction);

    // if JSON is truncated/invalid, do ONE strict retry
    if (r.ok) {
      const parsed = safeJsonExtract(r.agentReplyText);
      if (!parsed || typeof parsed !== "object") {
        r = await callAgent(
          req,
          patchInstruction +
            "\n\nRETRY: Your last response was invalid/truncated. Return ONLY 1..2 ops. NO JSX. Use insertAfter with an existing import line anchor."
        );
      }
    }

    if (!r.ok) {
      return NextResponse.json(
        { ok: false, error: `Agent failed for modify ${filePath} (${r.status})`, details: r.text },
        { status: 500 }
      );
    }

    const parsed = safeJsonExtract(r.agentReplyText);
    if (!parsed || typeof parsed !== "object") {
      return NextResponse.json(
        { ok: false, error: `Agent did not return valid JSON for ${filePath}.`, raw: r.agentReplyText },
        { status: 500 }
      );
    }

    const obj: any = parsed;
    const opsRaw = Array.isArray(obj?.ops) ? obj.ops : null;
    if (!opsRaw || opsRaw.length < 1) {
      return NextResponse.json(
        { ok: false, error: `Missing/empty ops for ${filePath}.`, raw: obj },
        { status: 500 }
      );
    }

    const ops = normalizePatchOps(opsRaw);
    const micro = validateMicroOps(ops);
    if (!micro.ok) {
      return NextResponse.json(
        { ok: false, error: `Modify ops rejected for ${filePath}: ${micro.error}`, raw: obj },
        { status: 500 }
      );
    }

    let next = current;
    try {
      for (const op of ops) {
        if (op.op === "insertAfter") next = applyInsertAfter(next, op.anchor, op.insertLines);
        else if (op.op === "insertBefore") next = applyInsertBefore(next, op.anchor, op.insertLines);
        else if (op.op === "replaceRegex") next = applyReplaceRegex(next, op.pattern, op.flags, op.replacementLines);
      }
    } catch (e: any) {
      return NextResponse.json(
        { ok: false, error: `Failed applying patch for ${filePath}: ${e?.message || "unknown error"}` },
        { status: 500 }
      );
    }

    if (!next.trim()) {
      return NextResponse.json(
        { ok: false, error: `Patch produced empty file for ${filePath}.` },
        { status: 500 }
      );
    }
    if (next.length > 70_000) {
      return NextResponse.json(
        { ok: false, error: `File too large (>70k chars): ${filePath}` },
        { status: 400 }
      );
    }

    files.push({ path: filePath, content: next });
  }

  // Create PR
  try {
    const res = await fetch(new URL("/api/admin/github/create-pr", req.url), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: req.headers.get("authorization") || "",
        "x-admin-token": req.headers.get("x-admin-token") || "",
        cookie: req.headers.get("cookie") || "",
      },
      body: JSON.stringify({ title, description, base, files }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json) {
      const t = await res.text().catch(() => "");
      return NextResponse.json(
        { ok: false, error: `Create PR failed (${res.status})`, details: t || json },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, result: json });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed to create PR." }, { status: 500 });
  }
}