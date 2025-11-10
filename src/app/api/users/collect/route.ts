// src/app/api/users/collect/route.ts
import { NextResponse } from "next/server";
import { createUser, listUsers } from "../store";

export const dynamic = "force-dynamic";

// POST /api/users/collect
// lightweight user capture from mobile
export async function POST(req: Request) {
  const body = await req.json();

  const newUser = createUser({
    name: body.name ?? body.firstName ?? "Anonymous visitor",
    email: body.email ?? "no-email@example.com",
    // so we can see in admin that this came from mobile/popup
    status: "collected",
    role: "viewer",
  });

  return NextResponse.json({ ok: true, item: newUser });
}

// GET /api/users/collect (optional) – just return everything
export async function GET() {
  return NextResponse.json({ items: listUsers() });
}