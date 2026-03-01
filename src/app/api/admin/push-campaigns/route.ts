import { NextRequest, NextResponse } from "next/server";
import { getPushCampaignCounts } from "./store";

function readTokenFromReq(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const x = req.headers.get("x-admin-token")?.trim() || "";
  const cookie = req.cookies.get("admin_token")?.value?.trim() || "";
  return bearer || x || cookie || "";
}

function requireOwner(req: NextRequest) {
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

export async function GET(req: NextRequest) {
  const auth = requireOwner(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  const counts = await getPushCampaignCounts();
  return NextResponse.json({ ok: true, counts });
}