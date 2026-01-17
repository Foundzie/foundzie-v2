// src/app/api/location/store.ts
import "server-only";
import { kvGetJSON, kvSetJSON } from "@/lib/kv/redis";

export type LastLocation = {
  roomId: string;
  lat: number;
  lng: number;
  accuracy?: number | null;
  source?: "browser" | "fallback" | "unknown";
  updatedAt: string; // ISO
};

function keyForRoom(roomId: string) {
  return `foundzie:location:${String(roomId || "").trim()}:v1`;
}

export async function getLastLocation(roomId: string): Promise<LastLocation | null> {
  const rid = String(roomId || "").trim();
  if (!rid) return null;
  return (await kvGetJSON<LastLocation>(keyForRoom(rid))) ?? null;
}

export async function setLastLocation(input: {
  roomId: string;
  lat: number;
  lng: number;
  accuracy?: number | null;
  source?: LastLocation["source"];
}): Promise<LastLocation> {
  const rid = String(input.roomId || "").trim();
  if (!rid) throw new Error("Missing roomId");

  const loc: LastLocation = {
    roomId: rid,
    lat: Number(input.lat),
    lng: Number(input.lng),
    accuracy: input.accuracy ?? null,
    source: input.source ?? "browser",
    updatedAt: new Date().toISOString(),
  };

  if (!Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) {
    throw new Error("Invalid lat/lng");
  }

  await kvSetJSON(keyForRoom(rid), loc);
  return loc;
}
