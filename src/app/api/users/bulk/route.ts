// src/app/api/users/bulk/route.ts
import { NextResponse } from "next/server";
import { bulkUpdateUsers } from "../store";

export const dynamic = "force-dynamic";

// POST /api/users/bulk { ids: string[], action: "activate" | "disable" }
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));
  const ids: string[] = Array.isArray(body.ids) ? body.ids.map(String) : [];
  const action = body.action as "activate" | "disable";

  if (ids.length === 0 || !["activate", "disable"].includes(action)) {
    return NextResponse.json(
      { ok: false, message: "Provide ids[] and action=activate|disable" },
      { status: 400 }
    );
  }

  const count = await bulkUpdateUsers(ids, {
    status: action === "activate" ? "active" : "disabled",
  });

  return NextResponse.json({ ok: true, count });
}
