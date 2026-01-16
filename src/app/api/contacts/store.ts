// src/app/api/contacts/store.ts
import "server-only";
import { kvGetJSON, kvSetJSON } from "@/lib/kv/redis";

export type Contact = {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
};

function keyForRoom(roomId: string) {
  return `foundzie:contacts:${roomId}:v1`;
}

function normalizeRoomId(roomId: string) {
  return String(roomId || "").trim();
}

function cleanText(s: unknown) {
  return String(s || "").trim();
}

export async function listContacts(roomId: string): Promise<Contact[]> {
  const rid = normalizeRoomId(roomId);
  if (!rid) return [];

  const items = (await kvGetJSON<Contact[]>(keyForRoom(rid))) ?? [];
  return Array.isArray(items) ? items : [];
}

export async function addContact(roomId: string, input: { name: string; phone: string }) {
  const rid = normalizeRoomId(roomId);
  if (!rid) throw new Error("Missing roomId");

  const name = cleanText(input.name);
  const phone = cleanText(input.phone);

  if (!name) throw new Error("Missing contact name");
  if (!phone) throw new Error("Missing contact phone");

  const now = new Date().toISOString();
  const contact: Contact = {
    id: `ct-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    phone,
    createdAt: now,
  };

  const current = await listContacts(rid);

  // De-dupe by normalized phone + name (best-effort)
  const exists = current.some(
    (c) =>
      c.name.trim().toLowerCase() === name.toLowerCase() &&
      c.phone.replace(/\s+/g, "") === phone.replace(/\s+/g, "")
  );

  const next = exists ? current : [contact, ...current].slice(0, 200);
  await kvSetJSON(keyForRoom(rid), next);

  return { contact, list: next };
}

export async function deleteContact(roomId: string, contactId: string) {
  const rid = normalizeRoomId(roomId);
  const cid = cleanText(contactId);
  if (!rid) throw new Error("Missing roomId");
  if (!cid) throw new Error("Missing contactId");

  const current = await listContacts(rid);
  const next = current.filter((c) => c.id !== cid);
  await kvSetJSON(keyForRoom(rid), next);

  return { removed: current.length !== next.length, list: next };
}
