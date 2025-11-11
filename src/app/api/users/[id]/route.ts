// src/app/api/users/[id]/route.ts
import { NextResponse } from "next/server";
import { getUser, updateUser } from "../store";

export const dynamic = "force-dynamic";

// GET /api/users/:id → return one user
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = getUser(params.id);
  if (!user) {
    return NextResponse.json(
      { ok: false, message: "User not found" },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true, item: user });
}

// PATCH /api/users/:id → update one user
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const updated = updateUser(params.id, body);

  if (!updated) {
    return NextResponse.json(
      { ok: false, message: "User not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, item: updated });
}
