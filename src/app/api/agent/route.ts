// src/app/api/agent/route.ts

import { NextRequest, NextResponse } from "next/server";
import { runFoundzieAgent } from "@/lib/agent/runtime";
import { coreTools } from "@/lib/agent/spec";
import { toolImplementations } from "@/lib/agent/tools";

export const dynamic = "force-dynamic";

// POST /api/agent
// Body: { input: string, roomId?: string, userId?: string }
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as any;

  const inputRaw =
    typeof body.input === "string" && body.input.trim().length > 0
      ? body.input.trim()
      : "Admin sent an empty prompt.";

  const roomId =
    typeof body.roomId === "string" && body.roomId.trim().length > 0
      ? body.roomId.trim()
      : "admin-debug";

  const userId =
    typeof body.userId === "string" && body.userId.trim().length > 0
      ? body.userId.trim()
      : null;

  const agentResult = await runFoundzieAgent({
    input: inputRaw,
    roomId,
    userId,
    source: "admin",
    toolsMode: "debug", // Admin debug: allow tools
  });

  const availableTools = coreTools.map((t) => t.name);
  const implementedTools = Object.keys(toolImplementations);

  return NextResponse.json({
    ok: true,
    agentReply: agentResult.replyText,
    usedTools: agentResult.usedTools,
    debug: agentResult.debug,
    systemPromptPreview: agentResult.debug?.systemPromptPreview,
    availableTools,
    implementedTools,
  });
}

// Simple sanity GET
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Foundzie agent endpoint is live.",
  });
}
