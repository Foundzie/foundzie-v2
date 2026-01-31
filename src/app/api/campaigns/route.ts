import { NextResponse } from "next/server";
import {
  listCampaigns,
  upsertCampaignFromPayload,
  deliverCampaignPush,
} from "@/app/api/campaigns/store";

export const dynamic = "force-dynamic";

// GET /api/campaigns -> list all campaigns
export async function GET() {
  const items = await listCampaigns();
  return NextResponse.json({ ok: true, items });
}

// POST /api/campaigns -> create/update campaign
// optional query: ?deliver=1 will deliver push immediately if active
export async function POST(req: Request) {
  const url = new URL(req.url);
  const deliver = url.searchParams.get("deliver") === "1";
  const force = url.searchParams.get("force") === "1";

  const data = await req.json().catch(() => ({} as any));
  const result = await upsertCampaignFromPayload(data);

  let delivery: any = null;
  if (deliver && result.item?.id) {
    delivery = await deliverCampaignPush(result.item.id, force);
  }

  return NextResponse.json({
    ok: true,
    created: result.created,
    updated: result.updated,
    item: result.item,
    delivery,
  });
}

// POST /api/campaigns/deliver (not required yet) -> we keep everything in POST ?deliver=1
