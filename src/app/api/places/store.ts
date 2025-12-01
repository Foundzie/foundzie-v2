// src/app/api/places/store.ts

import { allPlaces } from "@/app/data/places";

export type StoredPlace = {
  id: string;
  name: string;
  category?: string;
  distanceMiles?: number;
  rating?: number;
  reviews?: number;
  openUntil?: string;
  address?: string | null;
  source: "local" | "google";
};

type NearbyParams = {
  lat?: number;
  lng?: number;
};

// -------- Google Places (New) config ----------

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// Simple: 3km radius around the user
const GOOGLE_PLACES_RADIUS_METERS = 3000;

/**
 * Call Google Places (New) "searchNearby" endpoint.
 * Docs: Places API (New) HTTP REST.
 */
async function fetchFromGooglePlaces(
  lat: number,
  lng: number
): Promise<StoredPlace[]> {
  if (!GOOGLE_PLACES_API_KEY) {
    console.warn("[places] No GOOGLE_PLACES_API_KEY set, skipping Google.");
    return [];
  }

  const url = "https://places.googleapis.com/v1/places:searchNearby";

  const body = {
    includedTypes: [
      "restaurant",
      "cafe",
      "tourist_attraction",
      "bar",
      "night_club",
      "shopping_mall",
    ],
    maxResultCount: 8,
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: GOOGLE_PLACES_RADIUS_METERS,
      },
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.primaryType,places.location,places.rating,places.userRatingCount",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(
      "[places] Google Places error",
      res.status,
      res.statusText,
      text
    );
    return [];
  }

  const json: any = await res.json().catch(() => ({}));
  const rawPlaces: any[] = Array.isArray(json.places) ? json.places : [];

  const mapped: StoredPlace[] = rawPlaces.map((p, idx) => ({
    id: p.id || `google-${idx}`,
    name: p.displayName?.text || "Unnamed place",
    category: p.primaryType || "place",
    // We’re not computing exact distance here; Nearby endpoint already sorts.
    distanceMiles: undefined,
    rating: typeof p.rating === "number" ? p.rating : undefined,
    reviews:
      typeof p.userRatingCount === "number" ? p.userRatingCount : undefined,
    openUntil: undefined,
    address: null,
    source: "google",
  }));

  return mapped;
}

// -------- Public function used by route.ts ----------

export async function getPlacesNearby(params: NearbyParams) {
  const { lat, lng } = params;

  // 1) If we have lat/lng and a Google key, try Google first
  if (typeof lat === "number" && typeof lng === "number") {
    try {
      const googleResults = await fetchFromGooglePlaces(lat, lng);
      if (googleResults.length > 0) {
        console.log(
          `[places] Using Google Places data (${googleResults.length} results)`
        );
        return {
          source: "google" as const,
          places: googleResults,
        };
      }
    } catch (err) {
      console.error("[places] Failed calling Google Places", err);
    }
  }

  // 2) Fallback to your local sample list
  console.log(
    "[places] Falling back to local sample data (no external results)"
  );
  const localPlaces: StoredPlace[] = allPlaces.map((p: any) => ({
    ...p,
    source: "local" as const,
  }));

  return {
    source: "local" as const,
    places: localPlaces,
  };
}
