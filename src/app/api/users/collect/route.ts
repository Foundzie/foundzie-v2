// src/app/api/users/collect/route.ts
import { NextResponse } from "next/server";
import { createUser, listUsers } from "../store";

export const dynamic = "force-dynamic";

type CollectBody = {
  name?: string;
  firstName?: string;
  email?: string;
  phone?: string;
  interest?: string;
  source?: string;
  tags?: string[] | string;
};

// POST /api/users/collect → lightweight visitor capture
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as CollectBody;

  // Handle tags cleanly:
  // - If mobile sends comma-separated string → split safely
  // - If array → use directly (and trim)
  let tags: string[] = [];

  if (Array.isArray(body.tags)) {
    tags = (body.tags as string[])
      .filter((t: string) => typeof t === "string" && t.trim() !== "")
      .map((t: string) => t.trim());
  } else if (typeof body.tags === "string") {
    tags = body.tags
      .split(",")
      .map((t: string) => t.trim())
      .filter((t: string) => t.length > 0);
  }

  const newUser = await createUser({
    name: body.name ?? body.firstName ?? "Anonymous visitor",
    email: body.email ?? "no-email@example.com",
    phone: body.phone ?? null,
    role: "viewer",
    status: "collected",
    interest: body.interest ?? "",
    source: body.source ?? "mobile",
    tags,
  });

  return NextResponse.json({ ok: true, item: newUser });
}

// optional GET → return everything (so admin can see collected too)
export async function GET() {
  const items = await listUsers();
  return NextResponse.json({ items });
}
