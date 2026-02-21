import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const COOKIE_NAME = "foundzie_admin";

export async function requireAdminCookie() {
  const jar = await cookies();
  const c = jar.get(COOKIE_NAME)?.value;

  if (c !== "1") {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  return null;
}