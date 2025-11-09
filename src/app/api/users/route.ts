// src/app/api/users/route.ts
import { NextResponse } from "next/server";
import mockUsers, {
  type AdminUser,
} from "@/app/data/users";

// we'll keep an in-memory copy so POSTs show up right away
let users: AdminUser[] = [...mockUsers];

export const dynamic = "force-dynamic";

// GET /api/users  → { items: [...] }
export async function GET() {
  return NextResponse.json({ items: users });
}

// POST /api/users  → create a new user (mock)
export async function POST(req: Request) {
  const body = await req.json();

  const newUser: AdminUser = {
    id: (users.length + 1).toString(),
    name: body.name ?? "New user",
    email: body.email ?? "no-email@example.com",
    role: body.role ?? "viewer",
    status: body.status ?? "active",
    // match your display style in src/app/data/users.ts
    joined:
      body.joined ??
      new Date().toLocaleString("en-US", {
        month: "short",
        year: "numeric",
      }),
  };

  // put new ones at the top like we did for notifications
  users.unshift(newUser);

  return NextResponse.json({ item: newUser }, { status: 201 });
}
