import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const COOKIE_NAME = "foundzie_admin";

export function requireAdminCookie() {
  const c = cookies().get(COOKIE_NAME)?.value;
  if (c !== "1") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}