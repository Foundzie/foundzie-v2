// src/app/api/admin/maintenance/route.ts
import { NextResponse } from "next/server";
import {
  getMaintenanceState,
  setMaintenanceState,
} from "./store";

export const dynamic = "force-dynamic";

// GET /api/admin/maintenance
export async function GET() {
  const state = await getMaintenanceState();
  return NextResponse.json({ ok: true, state });
}

// POST /api/admin/maintenance
// Body: { enabled?: boolean, message?: string }
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as any;

    const enabled =
      typeof body.enabled === "boolean" ? body.enabled : undefined;
    const message =
      typeof body.message === "string" ? body.message : undefined;

    const updated = await setMaintenanceState({
      enabled,
      message,
      updatedBy: "admin",
    });

    return NextResponse.json({ ok: true, state: updated });
  } catch (err) {
    console.error("[/api/admin/maintenance] POST error:", err);
    return NextResponse.json(
      { ok: false, message: "Failed to update maintenance state" },
      { status: 500 }
    );
  }
}
