// src/app/mobile/places/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import MobileSaveButton from "@/app/components/MobileSaveButton";
import PlaceBookForm from "./PlaceBookForm";
import { allPlaces } from "@/app/data/places";

type NormalizedPlace = {
  id: string | number;
  name: string;
  category: string;
  distanceMiles?: number | null;
  rating?: number | null;
  reviews?: number | null;
  openUntil?: string | null;
  address?: string | null;
  source?: "google" | "osm" | "local";
  lat?: number | null;
  lng?: number | null;
};

type PlacesResponse = {
  success: boolean;
  source: "google" | "osm" | "local";
  count: number;
  places?: NormalizedPlace[];
  data?: NormalizedPlace[];
};

function pickPlaces(json: PlacesResponse): NormalizedPlace[] {
  if (Array.isArray(json.places)) return json.places;
  if (Array.isArray(json.data)) return json.data;
  return [];
}

async function getPositionOnce(timeoutMs = 4500): Promise<{ lat: number; lng: number } | null> {
  if (!navigator.geolocation) return null;

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { timeout: timeoutMs }
    );
  });
}

export default function MobilePlaceDetailPage() {
  const params = useParams();
  const rawParam = String(params?.id ?? "").trim();
  const idParam = decodeURIComponent(rawParam);

  const [place, setPlace] = useState<NormalizedPlace | null>(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const localFallback = useMemo(() => {
    return allPlaces.find((p) => String(p.id) === idParam) ?? null;
  }, [idParam]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      // ✅ instant local render (no spinner hell)
      if (localFallback) {
        setPlace({
          id: localFallback.id,
          name: localFallback.name,
          category: localFallback.category,
          distanceMiles: localFallback.distanceMiles,
          rating: localFallback.rating,
          reviews: localFallback.reviews,
          openUntil: localFallback.openUntil,
          address: null,
          source: "local",
        });
        setSource("local");
        setLoading(false);
      }

      try {
        const pos = await getPositionOnce(4500);
        const url = pos
          ? `/api/places?lat=${pos.lat}&lng=${pos.lng}`
          : `/api/places`;

        const res = await fetch(url, { cache: "no-store" });
        const json = (await res.json().catch(() => ({}))) as PlacesResponse;

        if (cancelled) return;

        if (!json?.success) {
          if (!localFallback) setError("Could not load this place. Please try again.");
          return;
        }

        setSource(json.source);

        const list = pickPlaces(json);
        const match = list.find((p) => String(p.id) === idParam) ?? null;

        if (match) {
          setPlace(match);
          setError(null);
          setLoading(false);
          return;
        }

        if (!localFallback) {
          setError("Place not found.");
          setPlace(null);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load place detail", err);
        if (!cancelled && !localFallback) {
          setError("Could not load this place. Please try again.");
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [idParam, localFallback]);

  const description =
    place?.source === "local" && localFallback?.description
      ? localFallback.description
      : undefined;

  let mapsUrl: string | null = null;
  if (place?.lat != null && place?.lng != null) {
    mapsUrl = `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
  } else if (place?.address) {
    mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      place.address
    )}`;
  }

  if (loading && !place) {
    return (
      <main className="min-h-screen bg-slate-950 text-white p-4">
        <header className="flex justify-between items-center mb-4">
          <Link href="/mobile" className="text-pink-400 underline text-sm">
            ← Back
          </Link>
        </header>
        <p className="text-slate-400 text-sm">Loading place details…</p>
      </main>
    );
  }

  if (!place) {
    return (
      <main className="min-h-screen bg-slate-950 text-white p-4">
        <header className="flex justify-between items-center mb-4">
          <Link href="/mobile" className="text-pink-400 underline text-sm">
            ← Back
          </Link>
        </header>
        <p className="text-slate-400 text-sm">{error || "Place not found."}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 space-y-6 pb-10">
      <header className="flex justify-between items-center mb-4">
        <Link href="/mobile" className="text-pink-400 underline text-sm">
          ← Back
        </Link>
        <MobileSaveButton placeId={String(place.id)} />
      </header>

      <section className="space-y-2">
        <div>
          <h1 className="text-xl font-bold mb-1">{place.name}</h1>
          <p className="text-slate-400 text-sm mb-1">
            {place.category}
            {source && (
              <span className="ml-1 text-[11px] text-slate-500">
                •{" "}
                {source === "google"
                  ? "via Google Places"
                  : source === "osm"
                  ? "via OpenStreetMap"
                  : "local sample"}
              </span>
            )}
          </p>

          {(place.distanceMiles != null || place.openUntil || place.rating != null) && (
            <p className="text-slate-300 text-xs mb-1 space-x-1">
              {place.distanceMiles != null && (
                <span>{Number(place.distanceMiles).toFixed(1)} mi</span>
              )}
              {place.rating != null && <span>• ⭐ {Number(place.rating).toFixed(1)}</span>}
              {place.reviews != null && <span>({place.reviews} reviews)</span>}
              {place.openUntil && <span>• open until {place.openUntil}</span>}
            </p>
          )}

          {place.address && (
            <p className="text-slate-400 text-xs mb-1">{place.address}</p>
          )}

          {description && (
            <p className="text-slate-200 text-sm mt-2">{description}</p>
          )}
        </div>

        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-full bg-pink-600 px-4 py-2 text-xs font-medium text-white mt-2"
          >
            Open in Google Maps
          </a>
        )}
      </section>

      <PlaceBookForm placeId={String(place.id)} placeName={place.name} />
    </main>
  );
}
