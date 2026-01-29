// src/app/api/location/reverse/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/location/reverse?lat=...&lng=...
export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ ok: false, message: "Invalid lat/lng" }, { status: 400 });
  }

  const u = new URL("https://nominatim.openstreetmap.org/reverse");
  u.searchParams.set("format", "jsonv2");
  u.searchParams.set("lat", String(lat));
  u.searchParams.set("lon", String(lng));
  u.searchParams.set("zoom", "14");
  u.searchParams.set("addressdetails", "1");

  try {
    const r = await fetch(u.toString(), {
      headers: {
        // OSM requires a UA; keep same pattern you used in places/store.ts
        "User-Agent": "FoundzieDev/1.0 (foundzie@example.com)",
        "Accept-Language": "en",
      },
      cache: "no-store",
    });

    if (!r.ok) {
      return NextResponse.json({ ok: false, message: "Reverse geocode failed" }, { status: 502 });
    }

    const j: any = await r.json().catch(() => ({}));
    const addr = j?.address ?? {};

    const city =
      addr.city ||
      addr.town ||
      addr.village ||
      addr.suburb ||
      addr.neighbourhood ||
      "";

    const state = addr.state || addr.region || "";
    const country = addr.country || "";
    const label = [city, state].filter(Boolean).join(", ") || j?.display_name || "";

    return NextResponse.json({
      ok: true,
      item: {
        label,
        city,
        state,
        country,
        displayName: j?.display_name || null,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
