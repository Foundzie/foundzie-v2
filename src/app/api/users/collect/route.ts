// src/app/api/users/collect/route.ts
import { NextResponse } from "next/server";
import { createUser, listUsers } from "@/store";

export const dynamic = "force-dynamic";

// POST /api/users/collect
// lightweight user capture: name, email, etc.
export async function POST(req: Request) {
  const body = await req.json();

  const newUser = createUser({
    name: body.name ?? body.firstName ?? "Anonymous visitor",
    email: body.email ?? "no-email@example.com",
    role: "viewer",
    status: "collected",
    // NEW optional fields
    interest: body.interest ?? "",
    source: body.source ?? "mobile",
  });

  return NextResponse.json({ ok: true, item: newUser });
}

// optional GET to see what was collected
export async function GET() {
  return NextResponse.json({ items: listUsers() });
}
