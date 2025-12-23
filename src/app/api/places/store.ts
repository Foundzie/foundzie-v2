// src/app/api/places/store.ts
import "server-only";
import { allPlaces } from "@/app/data/places";

export type InteractionMode = "normal" | "child";

export type NormalizedPlace = {
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

type GetPlacesParams = {
  lat?: number;
  lng?: number;
  q?: string;
  mode: InteractionMode;
};

type GetPlacesResult = {
  source: "google" | "osm" | "local";
  places: NormalizedPlace[];
};

/* -------------------------------------------------------------------------- */
/*  Simple in-memory daily counter for Google calls (protect free tier)        */
/* -------------------------------------------------------------------------- */

let googleCallsDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
let googleCallsToday = 0;

function canUseGoogle(): boolean {
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

function filterForMode(list: NormalizedPlace[], mode: InteractionMode) {
  return mode === "child"
    ? list.filter((p) => isChildSafe(p.category, p.name))
    : list;
}

/* -------------------------------------------------------------------------- */
/*  Google Places API (New)                                                   */
/*  - Nearby: places:searchNearby                                             */
/*  - Text:   places:searchText (for q searches)                              */
/* -------------------------------------------------------------------------- */

const GOOGLE_RADIUS_METERS = 3000;

const GOOGLE_FIELD_MASK =
  "places.id,places.displayName,places.primaryType,places.location,places.formattedAddress,places.rating,places.userRatingCount";

function mapGooglePlace(
  p: any,
  idx: number,
  hasLocation: boolean,
  lat?: number,
  lng?: number
): NormalizedPlace {
  const placeLat = Number(p.location?.latitude);
  const placeLng = Number(p.location?.longitude);

  let distanceMiles: number | null = null;
  if (
    hasLocation &&
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(placeLat) &&
    Number.isFinite(placeLng)
  ) {
    distanceMiles = Number(
      haversineMiles(lat, lng, placeLat, placeLng).toFixed(2)
    );
  }

  const category =
    typeof p.primaryType === "string" && p.primaryType
      ? p.primaryType.replace(/_/g, " ")
      : "place";

  return {
    id: p.id ?? `google-${idx}`,
    name: p.displayName?.text ?? "Unknown place",
    category,
    distanceMiles,
    rating: typeof p.rating === "number" ? p.rating : null,
    reviews: typeof p.userRatingCount === "number" ? p.userRatingCount : null,
    openUntil: null,
    address: typeof p.formattedAddress === "string" ? p.formattedAddress : null,
    source: "google",
    lat: Number.isFinite(placeLat) ? placeLat : undefined,
    lng: Number.isFinite(placeLng) ? placeLng : undefined,
  };
}

async function fetchGoogleNearby(params: GetPlacesParams): Promise<NormalizedPlace[]> {
  if (!canUseGoogle()) return [];
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return [];

  const { lat, lng, mode } = params;
  if (!(typeof lat === "number" && typeof lng === "number")) return [];

  registerGoogleCall();

  const url = "https://places.googleapis.com/v1/places:searchNearby";

  const body = {
    maxResultCount: 18,
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: GOOGLE_RADIUS_METERS,
      },
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": GOOGLE_FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[places] Google Nearby error", res.status, res.statusText, text);
    return [];
  }

  const json: any = await res.json().catch(() => ({}));
  const raw: any[] = Array.isArray(json.places) ? json.places : [];

  const hasLocation = true;
  const mapped = raw.map((p, idx) => mapGooglePlace(p, idx, hasLocation, lat, lng));
  return filterForMode(mapped, mode);
}

async function fetchGoogleText(params: GetPlacesParams): Promise<NormalizedPlace[]> {
  if (!canUseGoogle()) return [];
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return [];

  const { lat, lng, q, mode } = params;
  const textQuery = (q || "").trim();
  if (!textQuery) return [];

  registerGoogleCall();

  const url = "https://places.googleapis.com/v1/places:searchText";

  const hasLocation = typeof lat === "number" && typeof lng === "number";

  const body: any = {
    textQuery,
    maxResultCount: 18,
  };

  // Bias results near user if we have coords (nice UX)
  if (hasLocation) {
    body.locationBias = {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: GOOGLE_RADIUS_METERS,
      },
    };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": GOOGLE_FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[places] Google Text error", res.status, res.statusText, text);
    return [];
  }

  const json: any = await res.json().catch(() => ({}));
  const raw: any[] = Array.isArray(json.places) ? json.places : [];

  const mapped = raw.map((p, idx) => mapGooglePlace(p, idx, hasLocation, lat, lng));
  return filterForMode(mapped, mode);
}

/* -------------------------------------------------------------------------- */
/*  OpenStreetMap / Nominatim fallback                                        */
/* -------------------------------------------------------------------------- */

async function fetchFromOpenStreetMap(params: GetPlacesParams): Promise<NormalizedPlace[]> {
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
    url.searchParams.set("viewbox", `${lng - d},${lat + d},${lng + d},${lat - d}`);
    url.searchParams.set("bounded", "1");
  }

  const res = await fetch(url.toString(), {
    headers: {
      // TODO: change this to a real domain/email in production
      "User-Agent": "FoundzieDev/1.0 (foundzie@example.com)",
    },
  });

  if (!res.ok) {
    console.error("[places] OSM error status:", res.status);
    return [];
  }

  const data = (await res.json().catch(() => [])) as any[];
  if (!Array.isArray(data)) return [];

  const results = data
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
        lat: Number.isFinite(placeLat) ? placeLat : undefined,
        lng: Number.isFinite(placeLng) ? placeLng : undefined,
      };

      return item;
    });

  return filterForMode(results, mode);
}

/* -------------------------------------------------------------------------- */
/*  Local fallback                                                            */
/* -------------------------------------------------------------------------- */

function getLocalPlaces(mode: InteractionMode): NormalizedPlace[] {
  const results: NormalizedPlace[] = allPlaces.map((p, idx) => ({
    id: String((p as any).id ?? idx),
    name: (p as any).name,
    category: (p as any).category,
    distanceMiles: typeof (p as any).distanceMiles === "number" ? (p as any).distanceMiles : null,
    rating: typeof (p as any).rating === "number" ? (p as any).rating : null,
    reviews: typeof (p as any).reviews === "number" ? (p as any).reviews : null,
    openUntil: (p as any).openUntil ?? null,
    address: null,
    source: "local",
  }));

  return filterForMode(results, mode);
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

export async function getPlaces(params: GetPlacesParams): Promise<GetPlacesResult> {
  const { q, lat, lng } = params;
  const hasQuery = typeof q === "string" && q.trim().length > 0;
  const hasLocation = typeof lat === "number" && typeof lng === "number";

  // 1) Prefer Google Text if user supplied q (best match for explicit searches)
  if (hasQuery) {
    try {
      const googleText = await fetchGoogleText(params);
      if (googleText.length > 0) return { source: "google", places: googleText };
    } catch (err) {
      console.error("[places] Google Text failed:", err);
    }
  }

  // 2) Otherwise, if we have location, try Google Nearby
  if (hasLocation) {
    try {
      const googleNearby = await fetchGoogleNearby(params);
      if (googleNearby.length > 0) return { source: "google", places: googleNearby };
    } catch (err) {
      console.error("[places] Google Nearby failed:", err);
    }
  }

  // 3) OSM fallback
  try {
    const osm = await fetchFromOpenStreetMap(params);
    if (osm.length > 0) return { source: "osm", places: osm };
  } catch (err) {
    console.error("[places] OSM failed:", err);
  }

  // 4) Local fallback
  return { source: "local", places: getLocalPlaces(params.mode) };
}
