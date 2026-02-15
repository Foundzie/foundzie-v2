// src/app/api/admin/logout/route.ts
import { NextResponse } from "next/server";

const COOKIE_NAME = "foundzie_admin";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 0,
  });
  return res;
}
