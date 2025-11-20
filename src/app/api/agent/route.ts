// src/app/api/agent/route.ts

import { NextRequest, NextResponse } from "next/server";
import { runFoundzieAgent } from "@/lib/agent/runtime";
import { coreTools } from "@/lib/agent/spec";
import { toolImplementations } from "@/lib/agent/tools";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as any;

  const input =
    typeof body.input === "string"
      ? body.input
      : typeof body.text === "string"
      ? body.text
      : "";

  const roomId =
    typeof body.roomId === "string" && body.roomId.trim()
      ? body.roomId.trim()
      : "admin-debug";

  const userId =
    typeof body.userId === "string" && body.userId.trim()
      ? body.userId.trim()
      : null;

  if (!input.trim()) {
    return NextResponse.json(
      { ok: false, message: "Missing input for agent." },
      { status: 400 }
    );
  }

  const agentResult = await runFoundzieAgent({
    input,
    roomId,
    userId,
    source: "admin",
    toolsMode: "debug", // let the model use tools in this endpoint
  });

  return NextResponse.json({
    ok: true,
    agentReply: agentResult.replyText,
    usedTools: agentResult.usedTools,
    debug: agentResult.debug,
    systemPromptPreview: agentResult.debug?.systemPromptPreview,
    availableTools: coreTools.map((t) => t.name),
    implementedTools: Object.keys(toolImplementations),
  });
}
