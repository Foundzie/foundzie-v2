import { NextRequest, NextResponse } from "next/server";
import { addMessage } from "@/app/api/chat/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
  if (!/^(hey|hi|hello|yo|good (morning|afternoon|evening))\b/.test(t))
    return false;
  if (/(how can i help|how may i help|assist you|help you|this is foundzie)/.test(t))
    return true;
  if (t.length <= 80) return true;
  return false;
}

function now() {
  return Date.now();
}

/* -----------------------------------------------------------
 * Voice → Actions v1 (lightweight intent detection)
 * -----------------------------------------------------------
 * We DO NOT pretend to complete bookings/calls.
 * We only:
 *  - create an "action request" record (in-memory)
 *  - optionally add ONE short follow-up concierge message if needed
 */

type ActionType =
  | "booking_request"
  | "save_place_request"
  | "call_place_request"
  | "directions_request"
  | "share_request"
  | "sos_trigger";

type ActionItem = {
  id: string;
  roomId: string;
  type: ActionType;
  createdAt: number;
  text: string;
  payload?: Record<string, any>;
};

const ACTIONS_BY_ROOM = new Map<string, ActionItem[]>();

const ACTION_DEDUP_MS = 45_000; // prevent repeated action spam per room/type

function pushAction(roomId: string, action: ActionItem) {
  const prev = ACTIONS_BY_ROOM.get(roomId) ?? [];
  ACTIONS_BY_ROOM.set(roomId, [action, ...prev].slice(0, 50));
}

function recentlyHadAction(roomId: string, type: ActionType) {
  const list = ACTIONS_BY_ROOM.get(roomId) ?? [];
  const latest = list.find((a) => a.type === type);
  if (!latest) return false;
  return now() - latest.createdAt <= ACTION_DEDUP_MS;
}

function detectActionIntent(
  rawText: string
): { type: ActionType; confidence: number; payload?: any } | null {
  const t = normalizeForHash(rawText);

  // SOS / emergency high priority
  if (
    /\b(sos|help me|emergency|call police|call an ambulance|medical emergency|fire)\b/.test(
      t
    )
  ) {
    return { type: "sos_trigger", confidence: 0.95 };
  }

  // booking-ish
  if (/\b(book|booking|reserve|reservation|get me a table|table for)\b/.test(t)) {
    // if they mention a place name after "at"
    const m = t.match(/\b(at)\s+(.{2,60})$/);
    const placeHint = m?.[2]?.trim();
    return {
      type: "booking_request",
      confidence: placeHint ? 0.85 : 0.7,
      payload: placeHint ? { placeHint } : undefined,
    };
  }

  // save/favorite
  if (/\b(save|favorite|favourite|bookmark|add to saved)\b/.test(t)) {
    const m = t.match(/\b(save|favorite|bookmark)\s+(.{2,60})$/);
    const placeHint = m?.[2]?.trim();
    return {
      type: "save_place_request",
      confidence: placeHint ? 0.85 : 0.65,
      payload: placeHint ? { placeHint } : undefined,
    };
  }

  // call place
  if (/\b(call|ring)\b/.test(t) && /\b(place|restaurant|them|this)\b/.test(t)) {
    return { type: "call_place_request", confidence: 0.72 };
  }
  if (/\bcall\s+(.{2,60})$/.test(t)) {
    const m = t.match(/\bcall\s+(.{2,60})$/);
    const placeHint = m?.[1]?.trim();
    return {
      type: "call_place_request",
      confidence: placeHint ? 0.85 : 0.65,
      payload: placeHint ? { placeHint } : undefined,
    };
  }

  // directions
  if (/\b(directions|navigate|how do i get there|route)\b/.test(t)) {
    return { type: "directions_request", confidence: 0.8 };
  }

  // share/send
  if (/\b(text me|send me|share (it|this)|message me)\b/.test(t)) {
    return { type: "share_request", confidence: 0.75 };
  }

  return null;
}

async function maybeAddConciergeFollowup(roomId: string, action: ActionItem) {
  // Keep this VERY short and only when we truly need missing details.
  // Also: don't spam — action dedup already protects.

  let followup: string | null = null;

  switch (action.type) {
    case "booking_request": {
      const placeHint = action.payload?.placeHint;
      followup = placeHint
        ? `Got it — what day/time and how many people for ${placeHint}?`
        : "Sure — which place should I book, and what day/time + party size?";
      break;
    }
    case "save_place_request": {
      const placeHint = action.payload?.placeHint;
      followup = placeHint
        ? `Done — I’ll save ${placeHint}. Want me to pull the details too?`
        : "Sure — which place should I save? (Say the name.)";
      break;
    }
    case "call_place_request": {
      const placeHint = action.payload?.placeHint;
      followup = placeHint
        ? `Okay — do you want me to call ${placeHint} now, or just grab the number first?`
        : "Okay — which place should I call? (Say the name.)";
      break;
    }
    case "directions_request": {
      followup = "Got it — which place are you heading to? (Say the name.)";
      break;
    }
    case "share_request": {
      followup = "Sure — do you want that sent by text or email?";
      break;
    }
    case "sos_trigger": {
      // Keep gentle + safety-forward
      followup = "I’m here. Are you in immediate danger right now?";
      break;
    }
    default:
      followup = null;
  }

  if (!followup) return;

  await addMessage(roomId, {
    sender: "concierge",
    text: followup,
    attachmentName: null,
    attachmentKind: null,
  });
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

  const sender: "user" | "concierge" =
    senderRaw === "concierge" ? "concierge" : "user";

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
  if (
    sender === "concierge" &&
    prev &&
    isGreetingLike(text) &&
    tNow - prev.ts <= GREETING_WINDOW_MS
  ) {
    return NextResponse.json({
      ok: true,
      deduped: true,
      reason: "greeting-window",
    });
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

  // ---- Voice → Actions v1 hook (only based on USER turns) ----
  // NOTE: This endpoint receives BOTH chat and voice transcript turns.
  // We keep this safe: only obvious intents, and dedup per room/type.
  if (sender === "user") {
    const intent = detectActionIntent(text);

    if (intent && intent.confidence >= 0.72) {
      const type = intent.type;

      if (!recentlyHadAction(roomId, type)) {
        const action: ActionItem = {
          id: `act-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          roomId,
          type,
          createdAt: Date.now(),
          text,
          payload: intent.payload,
        };

        pushAction(roomId, action);

        // Optional: add a single follow-up concierge question when needed
        // (keeps things feeling “action capable” without claiming completion)
        try {
          await maybeAddConciergeFollowup(roomId, action);
        } catch {
          // non-blocking
        }
      }
    }
  }

  return NextResponse.json({ ok: true, item });
}

export async function GET(req: NextRequest) {
  // Optional: allow admin/debug to see current action queue by roomId
  // GET /api/conversation/turn?roomId=visitor-123
  const roomId = req.nextUrl.searchParams.get("roomId")?.trim() || "";
  if (!roomId) {
    return NextResponse.json({
      ok: true,
      message: "conversation turn endpoint live",
      hint: "Pass ?roomId=... to see action queue for that room",
    });
  }

  const actions = ACTIONS_BY_ROOM.get(roomId) ?? [];
  return NextResponse.json({ ok: true, roomId, actions });
}
