// src/app/api/contacts/route.ts
import { NextResponse } from "next/server";
import { addContact, deleteContact, listContacts } from "./store";

export const dynamic = "force-dynamic";

// GET /api/contacts?roomId=...
export async function GET(req: Request) {
  const url = new URL(req.url);
  const roomId = (url.searchParams.get("roomId") || "").trim();

  if (!roomId) {
    return NextResponse.json(
      { ok: false, message: "Missing roomId" },
      { status: 400 }
    );
  }

  try {
    const items = await listContacts(roomId);
    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    // STRICT Upstash failures show here
    return NextResponse.json(
      {
        ok: false,
        message:
          typeof e?.message === "string" ? e.message : "Contacts read failed",
      },
      { status: 503 }
    );
  }
}

// POST /api/contacts  { roomId, name, phone }
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({} as any))) as {
    roomId?: string;
    name?: string;
    phone?: string;
  };

  const roomId = (body.roomId || "").trim();
  const name = (body.name || "").trim();
  const phone = (body.phone || "").trim();

  if (!roomId)
    return NextResponse.json({ ok: false, message: "Missing roomId" }, { status: 400 });
  if (!name)
    return NextResponse.json({ ok: false, message: "Missing name" }, { status: 400 });
  if (!phone)
    return NextResponse.json({ ok: false, message: "Missing phone" }, { status: 400 });

  try {
    const out = await addContact(roomId, { name, phone });
    return NextResponse.json({ ok: true, item: out.contact, items: out.list });
  } catch (e: any) {
    // STRICT Upstash failures should NOT be 400
    return NextResponse.json(
      {
        ok: false,
        message:
          typeof e?.message === "string" ? e.message : "Failed to add contact",
      },
      { status: 503 }
    );
  }
}

// DELETE /api/contacts  { roomId, contactId }
export async function DELETE(req: Request) {
  const body = (await req.json().catch(() => ({} as any))) as {
    roomId?: string;
    contactId?: string;
  };

  const roomId = (body.roomId || "").trim();
  const contactId = (body.contactId || "").trim();

  if (!roomId)
    return NextResponse.json({ ok: false, message: "Missing roomId" }, { status: 400 });
  if (!contactId)
    return NextResponse.json({ ok: false, message: "Missing contactId" }, { status: 400 });

  try {
    const out = await deleteContact(roomId, contactId);
    return NextResponse.json({ ok: true, removed: out.removed, items: out.list });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        message:
          typeof e?.message === "string"
            ? e.message
            : "Failed to delete contact",
      },
      { status: 503 }
    );
  }
}
