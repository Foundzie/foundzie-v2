// src/app/api/saved/route.ts
import { NextResponse } from "next/server";
import { savedPlaceIds } from "@/app/data/saved";

// keep an in-memory copy so POSTs show up right away
let savedIds = [...savedPlaceIds];

export const dynamic = "force-dynamic";

// GET /api/saved  → return list of saved place IDs
export async function GET() {
  return NextResponse.json({ items: savedIds });
}

// POST /api/saved
// body: { id: string, action: "add" | "remove" }
export async function POST(req: Request) {
  const body = await req.json();
  const { id, action } = body as { id?: string; action?: "add" | "remove" };

  if (!id) {
    return NextResponse.json(
      { ok: false, message: "id is required" },
      { status: 400 }
    );
  }

  if (action === "add") {
    if (!savedIds.includes(id)) {
      // put newest at the top (same pattern as notifications)
      savedIds.unshift(id);
    }
  } else if (action === "remove") {
    savedIds = savedIds.filter((x) => x !== id);
  } else {
    // if no action was provided, default to toggle
    if (savedIds.includes(id)) {
      savedIds = savedIds.filter((x) => x !== id);
    } else {
      savedIds.unshift(id);
    }
  }

  return NextResponse.json({ ok: true, items: savedIds });
}