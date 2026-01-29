// src/app/api/location/reverse/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Simple in-memory cache to reduce calls to Nominatim.
 * NOTE: This is per-server-instance (fine for stability + rate-limit protection).
 */
type CacheItem = {
  expiresAt: number;
  payload: any;
};

const CACHE = new Map<string, CacheItem>();

function cacheKey(lat: number, lng: number) {
  // rounding reduces cache fragmentation
  const a = lat.toFixed(5);
  const b = lng.toFixed(5);
  return `${a},${b}`;
}

function getCached(lat: number, lng: number) {
  const k = cacheKey(lat, lng);
  const hit = CACHE.get(k);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    CACHE.delete(k);
    return null;
  }
  return hit.payload;
}

function setCached(lat: number, lng: number, payload: any, ttlMs: number) {
  const k = cacheKey(lat, lng);
  CACHE.set(k, { expiresAt: Date.now() + ttlMs, payload });
}

function isValidLatLng(lat: number, lng: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  return true;
}

function json(body: any, status = 200) {
  return NextResponse.json(body, { status });
}

function safeLabelFromCoords(lat: number, lng: number) {
  return `near ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function pickUserAgent() {
  // Nominatim strongly prefers a descriptive UA with contact.
  // You can set these in Vercel env:
  // NOMINATIM_USER_AGENT="Foundzie/1.0 (contact: you@email.com)"
  // NOMINATIM_EMAIL="you@email.com"
  const ua =
    (process.env.NOMINATIM_USER_AGENT || "").trim() ||
    "Foundzie/1.0 (contact: admin@foundzie.com)";
  return ua;
}

function pickFromHeader() {
  // Optional, some deployments use this for contact
  const from = (process.env.NOMINATIM_EMAIL || "").trim();
  return from || "";
}

async function fetchWithTimeout(url: string, timeoutMs: number, headers: Record<string, string>) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
    const text = await res.text().catch(() => "");
    return { res, text };
  } finally {
    clearTimeout(t);
  }
}

async function tryNominatim(lat: number, lng: number) {
  const u = new URL("https://nominatim.openstreetmap.org/reverse");
  u.searchParams.set("format", "jsonv2");
  u.searchParams.set("lat", String(lat));
  u.searchParams.set("lon", String(lng));
  u.searchParams.set("zoom", "14");
  u.searchParams.set("addressdetails", "1");

  const headers: Record<string, string> = {
    "User-Agent": pickUserAgent(),
    "Accept-Language": "en",
  };

  const from = pickFromHeader();
  if (from) headers["From"] = from;

  // 4s timeout keeps your bridge snappy
  const { res, text } = await fetchWithTimeout(u.toString(), 4000, headers);

  if (!res.ok) {
    return {
      ok: false,
      provider: "nominatim",
      status: res.status,
      bodyPreview: text.slice(0, 300),
    };
  }

  let j: any = {};
  try {
    j = text ? JSON.parse(text) : {};
  } catch {
    return {
      ok: false,
      provider: "nominatim",
      status: 200,
      bodyPreview: text.slice(0, 300),
      parseError: true,
    };
  }

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

  const label =
    [city, state].filter(Boolean).join(", ") || j?.display_name || "";

  return {
    ok: true,
    provider: "nominatim",
    item: {
      label: String(label || "").trim(),
      city: city ? String(city) : null,
      state: state ? String(state) : null,
      country: country ? String(country) : null,
      displayName: j?.display_name ? String(j.display_name) : null,
    },
  };
}

async function tryGoogle(lat: number, lng: number) {
  const key = (process.env.GOOGLE_GEOCODING_API_KEY || "").trim();
  if (!key) return { ok: false, skipped: true };

  const u = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  u.searchParams.set("latlng", `${lat},${lng}`);
  u.searchParams.set("key", key);
  u.searchParams.set("language", "en");

  const { res, text } = await fetchWithTimeout(u.toString(), 4000, {
    "User-Agent": "Foundzie/1.0",
  });

  if (!res.ok) {
    return {
      ok: false,
      provider: "google",
      status: res.status,
      bodyPreview: text.slice(0, 300),
    };
  }

  let j: any = {};
  try {
    j = text ? JSON.parse(text) : {};
  } catch {
    return {
      ok: false,
      provider: "google",
      status: 200,
      bodyPreview: text.slice(0, 300),
      parseError: true,
    };
  }

  const results = Array.isArray(j?.results) ? j.results : [];
  const top = results[0] || null;

  const components = Array.isArray(top?.address_components) ? top.address_components : [];
  const getType = (t: string) =>
    components.find((c: any) => Array.isArray(c?.types) && c.types.includes(t))?.long_name || "";

  const city =
    getType("locality") ||
    getType("sublocality") ||
    getType("administrative_area_level_3") ||
    "";
  const state = getType("administrative_area_level_1") || "";
  const country = getType("country") || "";

  const label =
    [city, state].filter(Boolean).join(", ") || top?.formatted_address || "";

  return {
    ok: true,
    provider: "google",
    item: {
      label: String(label || "").trim(),
      city: city ? String(city) : null,
      state: state ? String(state) : null,
      country: country ? String(country) : null,
      displayName: top?.formatted_address ? String(top.formatted_address) : null,
    },
  };
}

// GET /api/location/reverse?lat=...&lng=...
export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));

  if (!isValidLatLng(lat, lng)) {
    return json({ ok: false, message: "Invalid lat/lng" }, 400);
  }

  // Cache hit (10 minutes)
  const cached = getCached(lat, lng);
  if (cached) return json(cached, 200);

  // 1) Try Nominatim
  try {
    const r1 = await tryNominatim(lat, lng);

    if (r1.ok) {
      const payload = { ok: true, source: r1.provider, item: r1.item };
      setCached(lat, lng, payload, 10 * 60 * 1000);
      return json(payload, 200);
    }

    // 2) Optional Google fallback
    const r2 = await tryGoogle(lat, lng);
    if (r2.ok) {
      const payload = { ok: true, source: r2.provider, item: r2.item };
      setCached(lat, lng, payload, 10 * 60 * 1000);
      return json(payload, 200);
    }

    // 3) Final fallback: never return 502 to the bridge (prevents locLabel null loops)
    // We still return ok:true so downstream can use a stable label.
    const fallbackLabel = safeLabelFromCoords(lat, lng);

    const payload = {
      ok: true,
      source: "fallback",
      item: {
        label: fallbackLabel,
        city: null,
        state: null,
        country: null,
        displayName: null,
      },
      warning: {
        message: "Reverse geocode unavailable (rate limit or upstream failure). Using fallback label.",
        nominatim: r1,
        google: r2,
      },
    };

    // Cache fallback briefly (30s) so we don't spam upstream
    setCached(lat, lng, payload, 30 * 1000);
    return json(payload, 200);
  } catch (e: any) {
    // Even here: do NOT emit 502; keep the bridge stable
    const fallbackLabel = safeLabelFromCoords(lat, lng);
    const payload = {
      ok: true,
      source: "fallback",
      item: {
        label: fallbackLabel,
        city: null,
        state: null,
        country: null,
        displayName: null,
      },
      warning: {
        message: "Reverse geocode exception. Using fallback label.",
        error: String(e?.message || e),
      },
    };
    setCached(lat, lng, payload, 30 * 1000);
    return json(payload, 200);
  }
}
