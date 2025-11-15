// src/app/api/sos/[id]/route.ts

import { NextResponse } from "next/server";
import { updateEvent } from "../store";
import type { SosStatus } from "../store";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = (await req.json().catch(() => ({}))) as any;
  const status = body.status as SosStatus | undefined;

  if (!status || !["new", "in-progress", "resolved"].includes(status)) {
    return NextResponse.json(
      { ok: false, message: "Invalid status" },
      { status: 400 }
    );
  }

  const updated = await updateEvent(params.id, { status });
  if (!updated) {
    return NextResponse.json(
      { ok: false, message: "SOS event not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, item: updated });
}
