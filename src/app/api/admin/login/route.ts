// src/app/api/admin/login/route.ts
import { NextResponse } from "next/server";

const COOKIE_NAME = "foundzie_admin";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = String(body?.token ?? "").trim();

  if (!process.env.ADMIN_TOKEN) {
    return new NextResponse("ADMIN_TOKEN is not set", { status: 500 });
  }

  if (!token || token !== process.env.ADMIN_TOKEN) {
    return new NextResponse("Invalid token", { status: 401 });
  }

  const res = NextResponse.json({ ok: true });

  // ✅ minimal-but-real: httpOnly cookie
  res.cookies.set({
    name: COOKIE_NAME,
    value: "1",
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 12, // 12 hours
  });

  return res;
}
