// scripts/smoke.mjs
// Usage:
//   ADMIN_TOKEN=... node scripts/smoke.mjs
//   SMOKE_BASE_URL=http://localhost:3000 ADMIN_TOKEN=... node scripts/smoke.mjs
// Optional:
//   CRON_SECRET=... to smoke /api/campaigns/run (if you want)

const BASE = (process.env.SMOKE_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const ADMIN_TOKEN = (process.env.ADMIN_TOKEN || "").trim();
const CRON_SECRET = (process.env.CRON_SECRET || "").trim();

function hdrs(extra = {}) {
  return {
    "content-type": "application/json",
    ...extra,
  };
}

async function hit(name, path, opts = {}) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, opts);
  const text = await res.text().catch(() => "");
  let json = null;
  try { json = JSON.parse(text); } catch {}
  const ok = res.ok;
  return { name, url, status: res.status, ok, json, text };
}

function logResult(r) {
  console.log(`\n[${r.ok ? "PASS" : "FAIL"}] ${r.name}`);
  console.log(`  ${r.status} ${r.url}`);
  if (!r.ok) {
    if (r.json) console.log("  body:", JSON.stringify(r.json, null, 2));
    else console.log("  body:", r.text.slice(0, 400));
  }
}

async function main() {
  console.log("Foundzie smoke running...");
  console.log("BASE:", BASE);

  let allOk = true;

  // 1) /api/agent GET (public-ish)
  const r1 = await hit("api/agent (GET)", "/api/agent", { method: "GET" });
  logResult(r1);
  allOk = allOk && r1.ok;

  // 2) /api/kv/diag (public-ish)
  const r2 = await hit("api/kv/diag (GET)", "/api/kv/diag", { method: "GET" });
  logResult(r2);
  allOk = allOk && r2.ok;

  // 3) /api/diag (owner-only)
  if (!ADMIN_TOKEN) {
    console.log("\n[SKIP] api/diag (ADMIN_TOKEN not set in env)");
  } else {
    const r3 = await hit("api/diag (GET)", "/api/diag", {
      method: "GET",
      headers: hdrs({ authorization: `Bearer ${ADMIN_TOKEN}` }),
    });
    logResult(r3);
    allOk = allOk && r3.ok;
  }

   // 4) optional: /api/campaigns/run (secured with CRON_SECRET)
  if (!CRON_SECRET) {
    console.log("\n[SKIP] api/campaigns/run (CRON_SECRET not set in env)");
  } else {
    const r4 = await hit("api/campaigns/run (GET)", "/api/campaigns/run", {
      method: "GET",
      headers: hdrs({ authorization: `Bearer ${CRON_SECRET}` }),
    });
    logResult(r4);
    // Optional: do not fail full smoke if this endpoint fails
  }


  console.log("\n==============================");
  console.log(allOk ? "SMOKE: PASS ✅" : "SMOKE: FAIL ❌");
  console.log("==============================\n");

  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error("SMOKE crashed:", e);
  process.exit(1);
});
