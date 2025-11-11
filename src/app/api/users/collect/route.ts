// src/app/api/users/collect/route.ts
import { NextResponse } from "next/server";
import { createUser, listUsers } from "../store";

export const dynamic = "force-dynamic";

// POST /api/users/collect  → capture lightweight visitor
export async function POST(req: Request) {
  const body = await req.json();

  const newUser = await createUser({
    name: body.name ?? body.firstName ?? "Anonymous visitor",
    email: body.email ?? "no-email@example.com",
    role: "viewer",
    status: "collected",
    interest: body.interest ?? "",
    source: body.source ?? "mobile",
  });

  return NextResponse.json({ ok: true, item: newUser });
}

// optional GET → return everything (so admin can see collected too)
export async function GET() {
  const items = await listUsers();
  return NextResponse.json({ items });
}
