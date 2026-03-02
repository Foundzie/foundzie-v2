import { NextResponse } from "next/server";
import { requireAdminCookie } from "../../_auth";
import {
  getGitHubConfig,
  ghFetch,
  extractPreviewUrlFromChecks,
} from "../../_github";

export async function GET(
  _: Request,
  ctx: { params: Promise<{ number: string }> }
) {
  const authFail = await requireAdminCookie();
  if (authFail) return authFail;

  const cfg = getGitHubConfig();
  if (!cfg.ok)
    return NextResponse.json({ ok: false, error: cfg.error }, { status: 500 });

  const { token, owner, repo } = cfg;
  const { number } = await ctx.params;
  const prNumber = Number(number);

  if (!Number.isFinite(prNumber)) {
    return NextResponse.json({ ok: false, error: "Invalid PR number" }, { status: 400 });
  }

  // 1) Fetch PR to get head SHA
  const prUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;
  const prRes = await ghFetch(token, prUrl);
  if (!prRes.ok) {
    return NextResponse.json(
      { ok: false, error: prRes.error, status: prRes.status },
      { status: 500 }
    );
  }

  const sha = prRes.json?.head?.sha;
  if (!sha) {
    return NextResponse.json({ ok: false, error: "PR head SHA missing" }, { status: 500 });
  }

  // 2) Fetch check-runs for that SHA
  const checksUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${sha}/check-runs`;
  const checksRes = await ghFetch(token, checksUrl);
  if (!checksRes.ok) {
    return NextResponse.json(
      { ok: false, error: checksRes.error, status: checksRes.status },
      { status: 500 }
    );
  }

  const previewUrl = extractPreviewUrlFromChecks(checksRes.json);

  const runs = Array.isArray(checksRes.json?.check_runs) ? checksRes.json.check_runs : [];
  const simplifiedRuns = runs.map((r: any) => ({
    name: r.name,
    status: r.status,
    conclusion: r.conclusion,
    detailsUrl: r.details_url,
    startedAt: r.started_at,
    completedAt: r.completed_at,
  }));

  return NextResponse.json({
    ok: true,
    pr: {
      number: prRes.json?.number,
      title: prRes.json?.title,
      htmlUrl: prRes.json?.html_url,
      state: prRes.json?.state,
      merged: Boolean(prRes.json?.merged_at),
      headSha: sha,
      headRef: prRes.json?.head?.ref,
      baseRef: prRes.json?.base?.ref,
    },
    checks: simplifiedRuns,
    previewUrl,
  });
}