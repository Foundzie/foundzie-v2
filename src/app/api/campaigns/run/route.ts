import { NextResponse } from "next/server";
import { runDueCampaigns } from "@/app/api/campaigns/store";

export const dynamic = "force-dynamic";

// POST /api/campaigns/run -> runs the scheduler once (manual trigger)
export async function POST() {
  const summary = await runDueCampaigns();
  return NextResponse.json(summary);
}

// GET can be useful for quick inspection too
export async function GET() {
  const summary = await runDueCampaigns();
  return NextResponse.json(summary);
}
