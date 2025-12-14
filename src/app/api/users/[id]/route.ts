// src/app/api/users/[id]/route.ts
import { NextResponse } from "next/server";
import { listUsers, updateUser, deleteUser } from "../store";

export const dynamic = "force-dynamic";

// Next.js 15+: context.params may be a Promise
async function unwrapParams(context: any): Promise<any> {
  const p = context?.params;
  if (!p) return {};
  if (typeof p?.then === "function") return await p; // Promise-like
  return p;
}

// Robust id resolver: try params first, then fall back to URL last segment
function resolveId(req: Request, params: any) {
  const fromParams = params?.id;
  if (typeof fromParams === "string" && fromParams.trim() !== "") {
    return decodeURIComponent(fromParams.trim());
  }

  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  const last = parts[parts.length - 1] ?? "";
  return decodeURIComponent(last.trim());
}

// GET /api/users/:id
export async function GET(req: Request, context: any) {
  const params = await unwrapParams(context);
  const id = resolveId(req, params);

  if (!id) {
    return NextResponse.json(
      { ok: false, message: "Missing id" },
      { status: 400 }
    );
  }

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
  const params = await unwrapParams(context);
  const id = resolveId(req, params);

  if (!id) {
    return NextResponse.json(
      { ok: false, message: "Missing id" },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const updated = await updateUser(id, body);

  if (!updated) {
    return NextResponse.json(
      { ok: false, message: "User not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, item: updated });
}

// DELETE /api/users/:id
export async function DELETE(req: Request, context: any) {
  const params = await unwrapParams(context);
  const id = resolveId(req, params);

  if (!id) {
    return NextResponse.json(
      { ok: false, message: "Missing id" },
      { status: 400 }
    );
  }

  const removed = await deleteUser(id);

  if (!removed) {
    return NextResponse.json(
      { ok: false, message: "User not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
