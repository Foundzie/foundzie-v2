import { NextResponse } from "next/server";
import { requireAdminCookie } from "../_auth";
import { getGitHubConfig, ghFetch } from "../_github";

export async function GET() {
  const authFail = await requireAdminCookie();
  if (authFail) return authFail;

  const cfg = getGitHubConfig();
  if (!cfg.ok)
    return NextResponse.json({ ok: false, error: cfg.error }, { status: 500 });

  const { token, owner, repo } = cfg;

  const url = `https://api.github.com/repos/${owner}/${repo}/pulls?state=all&per_page=20&sort=updated&direction=desc`;
  const r = await ghFetch(token, url);

  if (!r.ok) {
    return NextResponse.json(
      { ok: false, error: r.error, status: r.status },
      { status: 500 }
    );
  }

  const items = Array.isArray(r.json) ? r.json : [];
  const simplified = items.map((pr: any) => ({
    number: pr.number,
    title: pr.title,
    state: pr.state,
    merged: Boolean(pr.merged_at),
    draft: Boolean(pr.draft),
    updatedAt: pr.updated_at,
    htmlUrl: pr.html_url,
    headSha: pr.head?.sha,
    headRef: pr.head?.ref,
    baseRef: pr.base?.ref,
    user: pr.user?.login,
  }));

  return NextResponse.json({ ok: true, items: simplified });
}