// src/app/api/users/route.ts
import { NextResponse } from "next/server";
import { listUsers, createUser } from "./store";

export const dynamic = "force-dynamic";

// GET /api/users -> list everything we have in memory
export async function GET() {
  const items = listUsers();
  return NextResponse.json({ items });
}

// POST /api/users -> create a new (admin) user
export async function POST(req: Request) {
  const body = await req.json();

  const newUser = createUser({
    name: body.name,
    email: body.email,
    role: body.role ?? "viewer",
    status: body.status ?? "active",
    joined: body.joined,
  });

  return NextResponse.json({ item: newUser }, { status: 201 });
}
