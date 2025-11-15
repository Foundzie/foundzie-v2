// src/app/api/sos/[id]/route.ts

import { NextResponse } from "next/server";
import { updateEvent } from "../store";
import type { SosStatus } from "../store";

export async function PATCH(
  req: Request,
  context: any
) {
  const { params } = context ?? {};
  const id = (params?.id ?? "") as string;

  // Basic guard in case id is missing
  if (!id) {
    return NextResponse.json(
      { ok: false, message: "Missing SOS id" },
      { status: 400 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as any;
  const status = body.status as SosStatus | undefined;

  if (!status || !["new", "in-progress", "resolved"].includes(status)) {
    return NextResponse.json(
      { ok: false, message: "Invalid status" },
      { status: 400 }
    );
  }

  const updated = await updateEvent(id, { status });

  if (!updated) {
    return NextResponse.json(
      { ok: false, message: "SOS event not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, item: updated });
}
