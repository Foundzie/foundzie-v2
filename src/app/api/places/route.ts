// src/app/api/places/route.ts
import { NextResponse } from "next/server";
import { allPlaces } from "@/app/data/places";

export const dynamic = "force-dynamic";

type InteractionMode = "normal" | "child";

type NormalizedPlace = {
  id: string;
  name: string;
  category: string;
  distanceMiles: number | null;
  rating: number | null;
  reviews: number | null;
  openUntil: string | null;
  address: string | null;
  source: "google" | "osm" | "local";
  lat?: number;
  lng?: number;
};

/* -------------------------------------------------------------------------- */
/*  Simple in-memory daily counter for Google calls (to protect free tier)    */
/* -------------------------------------------------------------------------- */

let googleCallsDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
let googleCallsToday = 0;

function canUseGoogle(): boolean {
  // 🔑 IMPORTANT: use the same name as in .env & Vercel
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return false;

  const today = new Date().toISOString().slice(0, 10);
  if (today !== googleCallsDate) {
    googleCallsDate = today;
    googleCallsToday = 0;
  }

  const limitEnv = process.env.FOUNDZIE_PLACES_GOOGLE_DAILY_LIMIT;
  const limit = Number(limitEnv || "200") || 200;

  return googleCallsToday < limit;
}

function registerGoogleCall() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== googleCallsDate) {
    googleCallsDate = today;
    googleCallsToday = 0;
  }
  googleCallsToday += 1;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3958.8; // miles
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function isChildSafe(category: string, name: string): boolean {
  const text = (category + " " + name).toLowerCase();
  const banned = [
    "bar",
    "night club",
    "nightclub",
    "strip",
    "casino",
    "liquor",
    "adult",
  ];
  return !banned.some((b) => text.includes(b));
}

/* -------------------------------------------------------------------------- */
/*  Google Places (Text Search)                                               */
/* -------------------------------------------------------------------------- */

async function fetchFromGooglePlaces(params: {
  lat?: number;
  lng?: number;
  q?: string;
  mode: InteractionMode;
}): Promise<NormalizedPlace[]> {
  if (!canUseGoogle()) return [];

  const apiKey = process.env.GOOGLE_PLACES_API_KEY!; // 🔑 use PLACES key
  registerGoogleCall();

  const { lat, lng, q, mode } = params;
  const hasLocation = typeof lat === "number" && typeof lng === "number";

  const baseUrl =
    "https://maps.googleapis.com/maps/api/place/textsearch/json";

  const query =
    q && q.trim().length > 0
      ? q.trim()
      : hasLocation
      ? "things to do nearby"
      : "things to do in Chicago";

  const url = new URL(baseUrl);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("query", query);
  if (hasLocation) {
    url.searchParams.set("location", `${lat},${lng}`);
    url.searchParams.set("radius", "3000"); // ~3km
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    console.error("Google Places error status:", res.status);
    return [];
  }
  const data = (await res.json().catch(() => ({}))) as any;

  if (!data || !Array.isArray(data.results)) {
    return [];
  }

  const results: NormalizedPlace[] = data.results
    .map((p: any, idx: number) => {
      const placeLat = Number(p.geometry?.location?.lat);
      const placeLng = Number(p.geometry?.location?.lng);

      let distanceMiles: number | null = null;
      if (
        hasLocation &&
        Number.isFinite(placeLat) &&
        Number.isFinite(placeLng)
      ) {
        distanceMiles = Number(
          haversineMiles(lat!, lng!, placeLat, placeLng).toFixed(2)
        );
      }

      const types: string[] = Array.isArray(p.types) ? p.types : [];
      const primaryType =
        p.business_status === "OPERATIONAL" && types.length > 0
          ? types[0]
          : "place";

      const category = primaryType.replace(/_/g, " ");

      const item: NormalizedPlace = {
        id: p.place_id ?? `google-${idx}`,
        name: p.name ?? "Unknown place",
        category,
        distanceMiles,
        rating:
          typeof p.rating === "number" && !Number.isNaN(p.rating)
            ? p.rating
            : null,
        reviews:
          typeof p.user_ratings_total === "number" &&
          !Number.isNaN(p.user_ratings_total)
            ? p.user_ratings_total
            : null,
        openUntil: null,
        address: p.formatted_address ?? null,
        source: "google",
        lat: placeLat,
        lng: placeLng,
      };

      return item;
    })
    .filter((p: NormalizedPlace) =>
      mode === "child" ? isChildSafe(p.category, p.name) : true
    );

  return results;
}

/* -------------------------------------------------------------------------- */
/*  OpenStreetMap / Nominatim                                                 */
/* -------------------------------------------------------------------------- */

async function fetchFromOpenStreetMap(params: {
  lat?: number;
  lng?: number;
  q?: string;
  mode: InteractionMode;
}): Promise<NormalizedPlace[]> {
  const { lat, lng, q, mode } = params;

  const query =
    q && q.trim().length > 0
      ? q.trim()
      : lat && lng
      ? "things to do"
      : "fun places";

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "20");

  if (lat && lng) {
    const d = 0.03;
    url.searchParams.set(
      "viewbox",
      `${lng - d},${lat + d},${lng + d},${lat - d}`
    );
    url.searchParams.set("bounded", "1");
  }

  const res = await fetch(url.toString(), {
    headers: {
      // TODO: change this to a real domain/email in production
      "User-Agent": "FoundzieDev/1.0 (foundzie@example.com)",
    },
  });

  if (!res.ok) {
    console.error("OSM error status:", res.status);
    return [];
  }

  const data = (await res.json().catch(() => [])) as any[];

  if (!Array.isArray(data)) return [];

  const results: NormalizedPlace[] = data
    .map((p: any, idx: number) => {
      const placeLat = Number(p.lat);
      const placeLng = Number(p.lon);

      let distanceMiles: number | null = null;
      if (
        lat !== undefined &&
        lng !== undefined &&
        Number.isFinite(placeLat) &&
        Number.isFinite(placeLng)
      ) {
        distanceMiles = Number(
          haversineMiles(lat, lng, placeLat, placeLng).toFixed(2)
        );
      }

      const categoryRaw = `${p.class ?? ""} ${p.type ?? ""}`.trim();
      const category = categoryRaw || "place";

      const item: NormalizedPlace = {
        id: p.place_id ? String(p.place_id) : `osm-${idx}`,
        name: p.display_name?.split(",")[0] ?? "Unknown place",
        category,
        distanceMiles,
        rating: null,
        reviews: null,
        openUntil: null,
        address: p.display_name ?? null,
        source: "osm",
        lat: placeLat,
        lng: placeLng,
      };

      return item;
    })
    .filter((p: NormalizedPlace) =>
      mode === "child" ? isChildSafe(p.category, p.name) : true
    );

  return results;
}

/* -------------------------------------------------------------------------- */
/*  Local fallback (your existing mock data)                                  */
/* -------------------------------------------------------------------------- */

function getLocalPlaces(mode: InteractionMode): NormalizedPlace[] {
  return allPlaces
    .map((p, idx) => {
      const item: NormalizedPlace = {
        id: String(p.id ?? idx),
        name: p.name,
        category: p.category,
        distanceMiles:
          typeof p.distanceMiles === "number" ? p.distanceMiles : null,
        rating: typeof p.rating === "number" ? p.rating : null,
        reviews: typeof p.reviews === "number" ? p.reviews : null,
        openUntil: p.openUntil ?? null,
        address: null,
        source: "local",
      };
      return item;
    })
    .filter((p) => (mode === "child" ? isChildSafe(p.category, p.name) : true));
}

/* -------------------------------------------------------------------------- */
/*  Route handler                                                             */
/* -------------------------------------------------------------------------- */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const latParam = url.searchParams.get("lat");
  const lngParam = url.searchParams.get("lng");
  const q = url.searchParams.get("q") ?? undefined;
  const modeParam = url.searchParams.get("mode") ?? "normal";

  const lat =
    latParam !== null && latParam !== "" ? Number(latParam) : undefined;
  const lng =
    lngParam !== null && lngParam !== "" ? Number(lngParam) : undefined;

  const mode: InteractionMode = modeParam === "child" ? "child" : "normal";

  try {
    let places: NormalizedPlace[] = [];
    let source: "google" | "osm" | "local" = "local";

    // 1) Try Google Places if key + budget
    try {
      if (canUseGoogle()) {
        const googlePlaces = await fetchFromGooglePlaces({
          lat,
          lng,
          q,
          mode,
        });
        if (googlePlaces.length > 0) {
          places = googlePlaces;
          source = "google";
        }
      }
    } catch (err) {
      console.error("Error fetching from Google Places:", err);
    }

    // 2) If Google failed / empty, try OpenStreetMap
    if (places.length === 0) {
      try {
        const osmPlaces = await fetchFromOpenStreetMap({
          lat,
          lng,
          q,
          mode,
        });
        if (osmPlaces.length > 0) {
          places = osmPlaces;
          source = "osm";
        }
      } catch (err) {
        console.error("Error fetching from OpenStreetMap:", err);
      }
    }

    // 3) Fallback to your local mock dataset
    if (places.length === 0) {
      places = getLocalPlaces(mode);
      source = "local";
    }

    // tiny delay for realism (optional)
    await new Promise((r) => setTimeout(r, 80));

    return NextResponse.json({
      success: true,
      source,
      count: places.length,
      data: places,
    });
  } catch (err) {
    console.error("Error in /api/places:", err);
    return NextResponse.json(
      { success: false, message: "Failed to load places" },
      { status: 500 }
    );
  }
}
