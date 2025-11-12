// src/app/api/users/[id]/route.ts
import { NextResponse } from "next/server";
import { listUsers, updateUser, deleteUser } from "../store";

export const dynamic = "force-dynamic";

// get id from params or URL path (fallback)
function getId(req: Request, params?: { id?: string }) {
  if (params?.id && params.id.trim() !== "") return params.id.trim();
  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  return (parts[parts.length - 1] ?? "").trim();
}

// GET /api/users/:id
export async function GET(req: Request, ctx: { params?: { id?: string } }) {
  const id = getId(req, ctx.params);
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
export async function PATCH(req: Request, ctx: { params?: { id?: string } }) {
  const id = getId(req, ctx.params);
  const body = await req.json().catch(() => ({} as any));

  // normalize tags if present
  const rawTags = body.tags;
  const tags =
    Array.isArray(rawTags)
      ? rawTags.map((t: string) => t.trim()).filter(Boolean)
      : typeof rawTags === "string"
        ? rawTags.split(",").map((t: string) => t.trim()).filter(Boolean)
        : undefined;

  const updated = await updateUser(id, { ...body, ...(tags ? { tags } : {}) });

  if (!updated) {
    return NextResponse.json({ ok: false, message: "User not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, item: updated });
}

// DELETE /api/users/:id
export async function DELETE(req: Request, ctx: { params?: { id?: string } }) {
  const id = getId(req, ctx.params);
  const ok = await deleteUser(id);
  if (!ok) {
    return NextResponse.json({ ok: false, message: "User not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
