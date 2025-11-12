// src/app/api/users/route.ts
import { NextResponse } from "next/server";
import { listUsers, createUser } from "./store";

export const dynamic = "force-dynamic";

// GET /api/users -> list all
export async function GET() {
  const items = await listUsers();
  return NextResponse.json({ items });
}

// POST /api/users -> create new admin user
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));

  // allow comma string or array for tags
  const rawTags = body.tags;
  const tags: string[] =
    Array.isArray(rawTags)
      ? rawTags.map((t: string) => t.trim()).filter(Boolean)
      : typeof rawTags === "string"
        ? rawTags.split(",").map((t: string) => t.trim()).filter(Boolean)
        : [];

  const newUser = await createUser({
    name: body.name,
    email: body.email,
    role: body.role ?? "viewer",
    status: body.status ?? "active",
    joined: body.joined,
    interest: body.interest,
    source: body.source,
    tags,
  });

  return NextResponse.json({ item: newUser }, { status: 201 });
}
