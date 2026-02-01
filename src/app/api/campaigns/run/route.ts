import { NextRequest, NextResponse } from "next/server";
import { runDueCampaigns } from "@/app/api/campaigns/store";

export const dynamic = "force-dynamic";

/**
 * Only allow cron scheduler runs if the request includes:
 * Authorization: Bearer <CRON_SECRET>
 */
function requireCronAuth(req: NextRequest): NextResponse | null {
  const secret = (process.env.CRON_SECRET || "").trim();
  const auth = (req.headers.get("authorization") || "").trim();

  // If CRON_SECRET is not set, block for safety
  if (!secret) {
    return NextResponse.json(
      { ok: false, message: "CRON_SECRET is not set on the server." },
      { status: 500 }
    );
  }

  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  return null;
}

// POST /api/campaigns/run -> cron trigger (and manual trigger if you send the secret)
export async function POST(req: NextRequest) {
  const denied = requireCronAuth(req);
  if (denied) return denied;

  const summary = await runDueCampaigns();

  // ✅ Avoid TS warning: do NOT do { ok: true, ...summary }
  const payload: any =
    summary && typeof summary === "object" ? { ...(summary as any) } : { summary };

  payload.ok = true;
  return NextResponse.json(payload);
}

// GET /api/campaigns/run -> useful for testing WITH the secret (Postman/curl)
export async function GET(req: NextRequest) {
  const denied = requireCronAuth(req);
  if (denied) return denied;

  const summary = await runDueCampaigns();

  // ✅ Avoid TS warning: do NOT do { ok: true, ...summary }
  const payload: any =
    summary && typeof summary === "object" ? { ...(summary as any) } : { summary };

  payload.ok = true;
  return NextResponse.json(payload);
}
