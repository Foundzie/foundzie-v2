// src/app/api/agent/route.ts

import { NextResponse } from "next/server";
import { FOUNDZIE_SYSTEM_PROMPT, coreTools } from "@/lib/agent/spec";
import { toolImplementations } from "@/lib/agent/tools";
import { runFoundzieAgent } from "@/lib/agent/runtime";

export const dynamic = "force-dynamic";

// POST /api/agent
// Used by the admin "Agent debug" panel.
// Now actually calls runFoundzieAgent (OpenAI if configured, stub otherwise).
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as any;

  const input =
    typeof body.input === "string" && body.input.trim()
      ? body.input.trim()
      : "Test from /api/agent with empty input.";

  const roomId =
    typeof body.roomId === "string" ? body.roomId : undefined;

  const userId =
    typeof body.userId === "string" ? body.userId : undefined;

  const source =
    body.source === "admin" || body.source === "mobile" || body.source === "system"
      ? body.source
      : "admin";

  console.log("[agent] debug call:", { input, roomId, userId, source });

  const agentResult = await runFoundzieAgent({
    input,
    roomId,
    userId,
    source,
  });

  // Still return metadata so you can see tools + prompt fragment in the debug UI
  const availableTools = coreTools.map((t) => t.name);

  return NextResponse.json({
    ok: true,
    agentReply: agentResult.replyText,
    usedTools: agentResult.usedTools,
    debug: agentResult.debug,
    systemPromptPreview: FOUNDZIE_SYSTEM_PROMPT.slice(0, 200),
    availableTools,
    implementedTools: Object.keys(toolImplementations),
  });
}
