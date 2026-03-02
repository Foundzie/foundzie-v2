// src/app/api/admin/diag/route.ts
import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "foundzie_admin";

export async function GET(req: NextRequest) {
  const authed = req.cookies.get(COOKIE_NAME)?.value === "1";
  if (!authed) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const token = process.env.ADMIN_TOKEN?.trim();
  if (!token) {
    return new NextResponse("ADMIN_TOKEN missing", { status: 500 });
  }

  // Call your existing owner-only diag endpoint using the auth style it expects
  const url = new URL("/api/diag", req.nextUrl.origin);

  const upstream = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const text = await upstream.text();

  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") || "application/json",
      "Cache-Control": "no-store",
    },
  });
}