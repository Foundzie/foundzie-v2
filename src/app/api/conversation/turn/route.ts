import { NextRequest, NextResponse } from "next/server";
import { addMessage } from "@/app/api/chat/store";

export const dynamic = "force-dynamic";

/**
 * Simple in-memory dedup (per server instance).
 * Prevents repeated identical turns and suppresses rapid-fire concierge greetings.
 */
type CacheItem = { hash: string; ts: number; text: string };
const RECENT = new Map<string, CacheItem>();

const DEDUP_WINDOW_MS = 60_000; // 60s exact-repeat window
const GREETING_WINDOW_MS = 35_000; // suppress multiple concierge greetings within 35s

function normalizeForHash(s: string) {
  return (s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[“”"]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/[^\p{L}\p{N}\s'"!?.,-]/gu, ""); // keep letters/numbers/basic punctuation
}

function isGreetingLike(s: string) {
  const t = normalizeForHash(s);
  // "hey/hi/hello" type starts
  if (!/^(hey|hi|hello|yo|good (morning|afternoon|evening))\b/.test(t)) return false;
  // common concierge greeting phrases
  if (/(how can i help|how may i help|assist you|help you|this is foundzie)/.test(t)) return true;
  // even if short, treat as greeting if it starts greeting-ish and is short
  if (t.length <= 80) return true;
  return false;
}

function now() {
  return Date.now();
}

// POST /api/conversation/turn
// Body: { roomId: string, sender: "user" | "concierge", text: string, meta?: any }
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({} as any))) as any;

  const roomId = typeof body.roomId === "string" ? body.roomId.trim() : "";
  const senderRaw = typeof body.sender === "string" ? body.sender : "user";
  const textRaw = typeof body.text === "string" ? body.text : "";
  const text = textRaw.trim();

  if (!roomId || !text) {
    return NextResponse.json(
      { ok: false, message: "roomId + text are required" },
      { status: 400 }
    );
  }

  const sender: "user" | "concierge" = senderRaw === "concierge" ? "concierge" : "user";

  // ---- Dedup logic ----
  const tNow = now();
  const key = `${roomId}:${sender}`;
  const norm = normalizeForHash(text);

  // expire old cache entries (cheap)
  const prev = RECENT.get(key);
  if (prev && tNow - prev.ts > DEDUP_WINDOW_MS) {
    RECENT.delete(key);
  }

  // 1) Exact-repeat suppression (same normalized text within 60s)
  if (prev && prev.hash === norm && tNow - prev.ts <= DEDUP_WINDOW_MS) {
    return NextResponse.json({ ok: true, deduped: true, reason: "repeat" });
  }

  // 2) Concierge greeting suppression (multiple greetings within 35s)
  if (sender === "concierge" && prev && isGreetingLike(text) && tNow - prev.ts <= GREETING_WINDOW_MS) {
    return NextResponse.json({ ok: true, deduped: true, reason: "greeting-window" });
  }

  // update cache
  RECENT.set(key, { hash: norm, ts: tNow, text });

  // save message
  const item = await addMessage(roomId, {
    sender,
    text,
    attachmentName: null,
    attachmentKind: null,
  });

  return NextResponse.json({ ok: true, item });
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "conversation turn endpoint live" });
}
