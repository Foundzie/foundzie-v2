// src/app/api/users/[id]/route.ts
import { NextResponse } from "next/server";
import { listUsers, updateUser } from "../store";

export const dynamic = "force-dynamic";

// helper: get the id from params OR from the URL path
function getId(req: Request, params?: { id?: string }) {
  // 1. try params first
  if (params?.id && params.id.trim() !== "") {
    return params.id.trim();
  }

  // 2. fallback: read the last segment of the URL
  const url = new URL(req.url);
  const parts = url.pathname.split("/"); // ["", "api", "users", "18"]
  const last = parts[parts.length - 1];
  return last.trim();
}

// GET /api/users/:id → return one user
export async function GET(
  req: Request,
  ctx: { params?: { id?: string } }
) {
  const id = getId(req, ctx.params);

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

// PATCH /api/users/:id → update one user
export async function PATCH(
  req: Request,
  ctx: { params?: { id?: string } }
) {
  const id = getId(req, ctx.params);
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
