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

async function getPositionOnce(
  timeoutMs = 4500
): Promise<{ lat: number; lng: number } | null> {
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

      // instant local render
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
        const url = pos ? `/api/places?lat=${pos.lat}&lng=${pos.lng}` : `/api/places`;

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
    place?.source === "local" && localFallback?.description ? localFallback.description : undefined;

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
      <main className="min-h-screen bg-white text-slate-900">
        <div className="mx-auto max-w-md px-4 py-4">
          <Link href="/mobile" className="text-[13px] font-semibold text-blue-600">
            ← Back
          </Link>
          <p className="mt-6 text-slate-600 text-[13px]">Loading place details…</p>
        </div>
      </main>
    );
  }

  if (!place) {
    return (
      <main className="min-h-screen bg-white text-slate-900">
        <div className="mx-auto max-w-md px-4 py-4">
          <Link href="/mobile" className="text-[13px] font-semibold text-blue-600">
            ← Back
          </Link>
          <p className="mt-6 text-slate-600 text-[13px]">{error || "Place not found."}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-slate-900 pb-24">
      <div className="mx-auto max-w-md px-4 py-4 space-y-4">
        <header className="flex items-center justify-between">
          <Link href="/mobile" className="text-[13px] font-semibold text-blue-600">
            ← Back
          </Link>
          <MobileSaveButton placeId={String(place.id)} />
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h1 className="text-[18px] font-semibold leading-tight">{place.name}</h1>

          <p className="mt-1 text-[13px] text-slate-600">
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
            <p className="mt-2 text-[12px] text-slate-700">
              {place.distanceMiles != null && (
                <span>{Number(place.distanceMiles).toFixed(1)} mi</span>
              )}
              {place.rating != null && (
                <span className="ml-2">• ★ {Number(place.rating).toFixed(1)}</span>
              )}
              {place.reviews != null && <span className="ml-1">({place.reviews} reviews)</span>}
              {place.openUntil && <span className="ml-2">• open until {place.openUntil}</span>}
            </p>
          )}

          {place.address && <p className="mt-2 text-[12px] text-slate-600">{place.address}</p>}

          {description && <p className="mt-3 text-[13px] text-slate-800">{description}</p>}

          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-blue-600 px-4 py-3 text-[13px] font-semibold text-white shadow-sm active:scale-[0.99]"
            >
              Open in Google Maps
            </a>
          )}
        </section>

        <PlaceBookForm placeId={String(place.id)} placeName={place.name} />
      </div>
    </main>
  );
}
