// src/app/api/users/collect/route.ts
import { NextResponse } from "next/server";
import { createUser, listUsers } from "../store";

export const dynamic = "force-dynamic";

type CollectBody = {
  name?: string;
  firstName?: string;
  email?: string;
  phone?: string;
  interest?: string;
  interests?: string[]; // from onboarding
  city?: string; // from onboarding
  source?: string;
  tags?: string[] | string;
};

// POST /api/users/collect → lightweight visitor capture
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as CollectBody;

  // Normalise tags
  let tags: string[] = [];

  if (Array.isArray(body.tags)) {
    tags = (body.tags as string[])
      .filter((t: string) => typeof t === "string" && t.trim() !== "")
      .map((t: string) => t.trim());
  } else if (typeof body.tags === "string") {
    tags = body.tags
      .split(",")
      .map((t: string) => t.trim())
      .filter((t: string) => t.length > 0);
  }

  // Add interests & city into tags as well for richer filtering
  if (Array.isArray(body.interests)) {
    for (const label of body.interests) {
      const trimmed = typeof label === "string" ? label.trim() : "";
      if (trimmed) tags.push(trimmed);
    }
  }

  if (typeof body.city === "string" && body.city.trim()) {
    tags.push(`city:${body.city.trim()}`);
  }

  const combinedInterest =
    body.interest ??
    (Array.isArray(body.interests) && body.interests.length > 0
      ? body.interests.join(", ")
      : "");

  const newUser = await createUser({
    name: body.name ?? body.firstName ?? "Anonymous visitor",
    email: body.email ?? "no-email@example.com",
    phone: body.phone ?? null,
    role: "viewer",
    status: "collected",
    interest: combinedInterest,
    source: body.source ?? "mobile",
    tags,
  });

  return NextResponse.json({ ok: true, item: newUser });
}

// optional GET → return everything (so admin can see collected too)
export async function GET() {
  const items = await listUsers();
  return NextResponse.json({ items });
}
