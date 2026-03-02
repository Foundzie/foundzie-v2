import { NextResponse } from "next/server";
import { requireAdminCookie } from "../_auth";

type FileChange = { path: string; content: string };

function denyPath(p: string) {
  const bad =
    p.startsWith(".env") ||
    p.includes("..") ||
    p.startsWith("/") ||
    p.startsWith("\\") ||
    p.includes("\0");
  return bad;
}

function allowPath(p: string) {
  // Tight allowlist: expand carefully as needed
  return (
    p.startsWith("src/") ||
    p.startsWith("scripts/") ||
    p.startsWith(".github/workflows/") ||
    p === "package.json"
  );
}

async function gh(apiUrl: string, token: string, init?: RequestInit) {
  const res = await fetch(apiUrl, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const text = await res.text().catch(() => "");
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {}

  if (!res.ok) {
    return { ok: false as const, status: res.status, json, text };
  }
  return { ok: true as const, status: res.status, json };
}

export async function POST(req: Request) {
  // Owner-only: cookie gate (same pattern as pulls routes)
  const gate = await requireAdminCookie();
  if (gate) return gate;

  const owner = process.env.GITHUB_OWNER?.trim();
  const repo = process.env.GITHUB_REPO?.trim();
  const token = process.env.GITHUB_AUTOPILOT_TOKEN?.trim();

  if (!owner || !repo || !token) {
    return NextResponse.json(
      {
        ok: false,
        error: "missing_env",
        reason: "Set GITHUB_OWNER, GITHUB_REPO, GITHUB_AUTOPILOT_TOKEN",
      },
      { status: 500 }
    );
  }

  let body: {
    title: string;
    description?: string;
    base?: string; // default main
    branch?: string; // optional custom
    files: FileChange[];
    commitMessage?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "bad_json" },
      { status: 400 }
    );
  }

  const title = (body.title || "").trim();
  const description = (body.description || "").trim();
  const base = (body.base || "main").trim();
  const commitMessage = (body.commitMessage || `Autopilot: ${title}`).trim();
  const files = Array.isArray(body.files) ? body.files : [];

  if (!title || files.length === 0) {
    return NextResponse.json(
      { ok: false, error: "invalid_input", reason: "Need title + at least 1 file" },
      { status: 400 }
    );
  }

  for (const f of files) {
    if (!f?.path || typeof f.content !== "string") {
      return NextResponse.json(
        { ok: false, error: "invalid_file", reason: "Each file needs path + content" },
        { status: 400 }
      );
    }
    const p = f.path.trim();
    if (denyPath(p) || !allowPath(p)) {
      return NextResponse.json(
        {
          ok: false,
          error: "path_not_allowed",
          reason: `Blocked path: ${p}`,
        },
        { status: 400 }
      );
    }
  }

  const api = (p: string) => `https://api.github.com/repos/${owner}/${repo}${p}`;

  // 1) Get base branch SHA
  const baseRef = await gh(api(`/git/ref/heads/${base}`), token);
  if (!baseRef.ok) {
    return NextResponse.json(
      { ok: false, error: "base_ref_failed", details: baseRef.json || baseRef.text },
      { status: 500 }
    );
  }
  const baseSha = baseRef.json?.object?.sha;
  if (!baseSha) {
    return NextResponse.json(
      { ok: false, error: "base_sha_missing" },
      { status: 500 }
    );
  }

  // 2) Create new branch name
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const branch =
    (body.branch && body.branch.trim()) || `autopilot/${stamp}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`;

  // 3) Create ref
  const createRef = await gh(api(`/git/refs`), token, {
    method: "POST",
    body: JSON.stringify({
      ref: `refs/heads/${branch}`,
      sha: baseSha,
    }),
  });

  if (!createRef.ok) {
    return NextResponse.json(
      { ok: false, error: "create_branch_failed", details: createRef.json || createRef.text },
      { status: 500 }
    );
  }

  // 4) Create blobs
  const blobs: { path: string; sha: string }[] = [];
  for (const f of files) {
    const blob = await gh(api(`/git/blobs`), token, {
      method: "POST",
      body: JSON.stringify({
        content: f.content,
        encoding: "utf-8",
      }),
    });
    if (!blob.ok) {
      return NextResponse.json(
        { ok: false, error: "create_blob_failed", details: blob.json || blob.text },
        { status: 500 }
      );
    }
    blobs.push({ path: f.path.trim(), sha: blob.json?.sha });
  }

  // 5) Get base tree
  const commit = await gh(api(`/git/commits/${baseSha}`), token);
  if (!commit.ok) {
    return NextResponse.json(
      { ok: false, error: "base_commit_failed", details: commit.json || commit.text },
      { status: 500 }
    );
  }
  const baseTreeSha = commit.json?.tree?.sha;
  if (!baseTreeSha) {
    return NextResponse.json(
      { ok: false, error: "base_tree_missing" },
      { status: 500 }
    );
  }

  // 6) Create new tree
  const tree = await gh(api(`/git/trees`), token, {
    method: "POST",
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: blobs.map((b) => ({
        path: b.path,
        mode: "100644",
        type: "blob",
        sha: b.sha,
      })),
    }),
  });

  if (!tree.ok) {
    return NextResponse.json(
      { ok: false, error: "create_tree_failed", details: tree.json || tree.text },
      { status: 500 }
    );
  }
  const newTreeSha = tree.json?.sha;

  // 7) Create commit
  const newCommit = await gh(api(`/git/commits`), token, {
    method: "POST",
    body: JSON.stringify({
      message: commitMessage,
      tree: newTreeSha,
      parents: [baseSha],
    }),
  });

  if (!newCommit.ok) {
    return NextResponse.json(
      { ok: false, error: "create_commit_failed", details: newCommit.json || newCommit.text },
      { status: 500 }
    );
  }
  const newCommitSha = newCommit.json?.sha;

  // 8) Update ref to point to new commit
  const updateRef = await gh(api(`/git/refs/heads/${branch}`), token, {
    method: "PATCH",
    body: JSON.stringify({ sha: newCommitSha, force: false }),
  });

  if (!updateRef.ok) {
    return NextResponse.json(
      { ok: false, error: "update_ref_failed", details: updateRef.json || updateRef.text },
      { status: 500 }
    );
  }

  // 9) Open PR
  const pr = await gh(api(`/pulls`), token, {
    method: "POST",
    body: JSON.stringify({
      title,
      body: description || undefined,
      head: branch,
      base,
    }),
  });

  if (!pr.ok) {
    return NextResponse.json(
      { ok: false, error: "create_pr_failed", details: pr.json || pr.text },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    number: pr.json?.number,
    url: pr.json?.html_url,
    branch,
    base,
  });
}