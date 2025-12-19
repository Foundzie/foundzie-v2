// src/app/api/twilio/gather/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">This call is now handled by Foundzie.</Say>
  <Hangup/>
</Response>`,
    { headers: { "Content-Type": "text/xml" } }
  );
}

export async function GET() {
  return POST();
}
