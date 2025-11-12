// src/app/api/users/[id]/route.ts
import { NextResponse } from "next/server";
import { listUsers, updateUser } from "../store";

export const dynamic = "force-dynamic";

// GET /api/users/:id
export async function GET(_req: Request, ctx: any) {
  const id = decodeURIComponent(String(ctx?.params?.id ?? "").trim());
  if (!id) {
    return NextResponse.json({ ok: false, message: "Missing id" }, { status: 400 });
  }

  const all = await listUsers();
  const user = all.find((u) => String(u.id).trim() === id);

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        message: "User not found",
        debug: { askedFor: id, foundIds: all.map((u) => String(u.id).trim()) },
      },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, item: user });
}

// PATCH /api/users/:id
export async function PATCH(req: Request, ctx: any) {
  const id = decodeURIComponent(String(ctx?.params?.id ?? "").trim());
  if (!id) {
    return NextResponse.json({ ok: false, message: "Missing id" }, { status: 400 });
  }

  const body = await req.json();
  const updated = await updateUser(id, body);

  if (!updated) {
    return NextResponse.json({ ok: false, message: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, item: updated });
}
