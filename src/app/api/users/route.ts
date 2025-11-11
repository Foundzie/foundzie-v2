// src/app/api/users/route.ts
import { NextResponse } from "next/server";
import { listUsers, createUser } from "./store";

export const dynamic = "force-dynamic";

// GET /api/users  → list all
export async function GET() {
  const items = await listUsers();
  return NextResponse.json({ items });
}

// POST /api/users → create an admin user (used by /admin/users/new)
export async function POST(req: Request) {
  const body = await req.json();

  const newUser = await createUser({
    name: body.name,
    email: body.email,
    role: body.role ?? "viewer",
    status: body.status ?? "active",
    joined: body.joined,
    interest: body.interest,
    source: body.source,
  });

  return NextResponse.json({ item: newUser }, { status: 201 });
}
