import { NextResponse } from "next/server";
import { addEvent, listEvents } from "@/app/api/sos/store";
import { addCallLog, listCallLogs } from "@/app/api/calls/store";
import { kvDebugGetRaw } from "@/lib/kv/redis";

export const dynamic = "force-dynamic";

/**
 * GET /api/dev/seed
 *
 * Debug endpoint to verify:
 *  - Upstash / Redis connection
 *  - SOS store
 *  - Call logs store
 */
export async function GET() {
  try {
    // 1) Create a debug SOS event
    const sos = await addEvent({
      message: "DEBUG sos from /api/dev/seed",
      type: "general",
      source: "debug-seed",
      location: "Test location",
      phone: "555-000-0000",
      userId: "1",
    });

    // 2) Create a debug call log
    const call = await addCallLog({
      id: `debug-call-${Date.now()}`,
      userId: "1",
      userName: "Debug user",
      phone: "555-777-8888",
      note: "DEBUG call from /api/dev/seed",
      direction: "outbound",
    });

    // 3) Read back current lists
    const sosList = await listEvents();
    const callList = await listCallLogs();

    // 4) Debug raw KV contents for the new versioned keys
    const sosRaw = await kvDebugGetRaw("foundzie:sos:v2");
    const callsRaw = await kvDebugGetRaw("foundzie:calls:v2");

    return NextResponse.json({
      ok: true,
      sosCreated: sos,
      callCreated: call,
      sosCount: sosList.length,
      callCount: callList.length,
      debugKv: {
        sos: sosRaw,
        calls: callsRaw,
      },
    });
  } catch (err: any) {
    console.error("[/api/dev/seed] error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: String(err?.message ?? err),
      },
      { status: 500 }
    );
  }
}
