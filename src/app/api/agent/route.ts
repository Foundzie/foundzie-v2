// src/app/api/agent/route.ts

import { NextResponse } from "next/server";
import { FOUNDZIE_SYSTEM_PROMPT, coreTools } from "@/lib/agent/spec";
import { toolImplementations } from "@/lib/agent/tools";

export const dynamic = "force-dynamic";

// POST /api/agent
// For now, this is a stub so we can wire UI + backend
// without breaking your build. Next step: add real OpenAI integration.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  console.log("[agent] stub received:", body);

  // Use tool *names* instead of array indices like ["0","1","2","3"]
  const availableTools = coreTools.map((t) => t.name);

  return NextResponse.json({
    ok: true,
    message:
      "Foundzie agent backend stub is live. OpenAI integration will be wired in the next milestone.",
    systemPromptPreview: FOUNDZIE_SYSTEM_PROMPT.slice(0, 200),
    availableTools,
    implementedTools: Object.keys(toolImplementations),
  });
}
