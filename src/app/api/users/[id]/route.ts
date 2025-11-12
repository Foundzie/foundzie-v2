// src/app/api/users/[id]/route.ts
import { NextResponse } from "next/server";
import { listUsers, updateUser } from "../store";

export const dynamic = "force-dynamic";

// get id from params or from the URL path (fallback)
function getId(req: Request, params?: { id?: string }) {
  const fromParams = (params?.id ?? "").trim();
  if (fromParams) return fromParams;

  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  return (parts[parts.length - 1] ?? "").trim();
}

// GET /api/users/:id
export async function GET(req: Request, context: any) {
  const id = decodeURIComponent(getId(req, context?.params));

  const all = await listUsers();
  const user = all.find((u) => String(u.id).trim() === id);

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        message: "User not found",
        debug: {
          askedFor: id,
          foundIds: all.map((u) => String(u.id).trim()),
        },
      },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, item: user });
}

// PATCH /api/users/:id
export async function PATCH(req: Request, context: any) {
  const id = decodeURIComponent(getId(req, context?.params));
  const body = await req.json();

  const updated = await updateUser(id, body);
  if (!updated) {
    return NextResponse.json(
      { ok: false, message: "User not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, item: updated });
}
