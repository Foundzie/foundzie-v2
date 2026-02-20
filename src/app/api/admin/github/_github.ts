export function getGitHubConfig() {
  const token = process.env.GITHUB_TOKEN?.trim();
  const owner = process.env.GITHUB_OWNER?.trim();
  const repo = process.env.GITHUB_REPO?.trim();

  if (!token || !owner || !repo) {
    return {
      ok: false as const,
      error:
        "Missing GitHub env. Set GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO in Vercel + local env.",
    };
  }

  return { ok: true as const, token, owner, repo };
}

export async function ghFetch(token: string, url: string) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });

  const text = await res.text().catch(() => "");
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {}

  if (!res.ok) {
    return {
      ok: false as const,
      status: res.status,
      error: (json && (json.message || json.error)) || text || "GitHub request failed",
      json,
    };
  }

  return { ok: true as const, status: res.status, json };
}

export function extractPreviewUrlFromChecks(checkRuns: any): string | null {
  // Best-effort:
  // - Vercel check-runs often have a details_url pointing to the preview deployment.
  // - Sometimes the URL is in output.summary/text.
  const runs = Array.isArray(checkRuns?.check_runs) ? checkRuns.check_runs : [];
  const candidates: string[] = [];

  for (const r of runs) {
    if (typeof r?.details_url === "string") candidates.push(r.details_url);
    const summary = r?.output?.summary;
    const text = r?.output?.text;
    if (typeof summary === "string") candidates.push(summary);
    if (typeof text === "string") candidates.push(text);
  }

  const joined = candidates.join("\n");

  // Try to find a vercel.app URL
  const m = joined.match(/https?:\/\/[^\s)"]+vercel\.app[^\s)"]*/i);
  if (m?.[0]) return m[0];

  // Or a Vercel deployment/status URL
  const m2 = joined.match(/https?:\/\/[^\s)"]*vercel\.com[^\s)"]*/i);
  if (m2?.[0]) return m2[0];

  return null;
}