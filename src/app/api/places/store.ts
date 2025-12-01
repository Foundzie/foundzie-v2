// src/app/api/places/store.ts

import { allPlaces, type Place } from "@/app/data/places";

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// Result type so the route can see where data came from
export type PlacesResult = {
  source: "mock" | "google";
  places: Place[];
};

type NearbyOptions = {
  lat?: number;
  lng?: number;
  radiusMeters?: number;
};

/**
 * Very simple haversine distance to get miles between two lat/lngs.
 * Good enough for sorting, not for strict navigation.
 */
function distanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3958.8; // miles
  const toRad = (v: number) => (v * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Core function: tries Google Places Nearby Search if we have
 * a key + lat/lng. If anything is missing or fails, we fall
 * back to the local mock list.
 */
export async function getPlacesNearby(
  opts: NearbyOptions = {}
): Promise<PlacesResult> {
  const { lat, lng, radiusMeters = 1500 } = opts;

  // If no key or no coords → use mock only (zero cost).
  if (!GOOGLE_PLACES_API_KEY || typeof lat !== "number" || typeof lng !== "number") {
    return {
      source: "mock",
      places: allPlaces,
    };
  }

  try {
    const url = new URL(
      "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    );

    url.searchParams.set("key", GOOGLE_PLACES_API_KEY);
    url.searchParams.set("location", `${lat},${lng}`);
    url.searchParams.set("radius", String(radiusMeters));
    // For now we don’t filter by type so we get a mix of food / fun / etc.

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Google Places error: ${res.status}`);
    }

    const json = (await res.json()) as any;

    const results = Array.isArray(json.results) ? json.results : [];

    // Map Google results into our Place shape
    const places: Place[] = results.map((r: any, index: number) => {
      const placeLat = r.geometry?.location?.lat ?? lat;
      const placeLng = r.geometry?.location?.lng ?? lng;

      const miles =
        typeof placeLat === "number" && typeof placeLng === "number"
          ? distanceMiles(lat, lng, placeLat, placeLng)
          : 0;

      const primaryType =
        Array.isArray(r.types) && r.types.length > 0
          ? r.types[0].replace(/_/g, " ")
          : "place";

      return {
        id: index + 1,
        name: r.name ?? "Unknown place",
        category: primaryType,
        distanceMiles: Number(miles.toFixed(1)),
        rating: typeof r.rating === "number" ? r.rating : 0,
        reviews:
          typeof r.user_ratings_total === "number"
            ? r.user_ratings_total
            : 0,
        openUntil: "", // could be filled later using opening_hours
        trending: index < 3,
        description: r.vicinity ?? "",
      };
    });

    // If Google returned nothing, still fall back to mock
    if (places.length === 0) {
      return { source: "mock", places: allPlaces };
    }

    return {
      source: "google",
      places,
    };
  } catch (err) {
    console.error("getPlacesNearby: falling back to mock:", err);
    return {
      source: "mock",
      places: allPlaces,
    };
  }
}
