// src/app/api/users/[id]/route.ts
import { NextResponse } from "next/server";
import { getUser, updateUser, listUsers } from "../store";

export const dynamic = "force-dynamic";

// GET /api/users/:id → return one user
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getUser(params.id);

  if (!user) {
    // debug: show what the route actually sees
    const all = await listUsers();
    return NextResponse.json(
      {
        ok: false,
        message: "User not found",
        debug: {
          askedFor: params.id,
          foundIds: all.map((u) => u.id),
        },
      },
      { status: 404 }
    );
    // we can remove this "debug" block after we confirm it sees ["1","2","3","4"]
  }

  return NextResponse.json({ ok: true, item: user });
}

// PATCH /api/users/:id → update one user
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const updated = await updateUser(params.id, body);

  if (!updated) {
    return NextResponse.json(
      { ok: false, message: "User not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, item: updated });
}
