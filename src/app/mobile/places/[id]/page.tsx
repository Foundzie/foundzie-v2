"use client";

import { useEffect, useState } from "react";
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
  data: NormalizedPlace[];
};

export default function MobilePlaceDetailPage() {
  const params = useParams();
  const idParam = String(params?.id ?? "");

  const [place, setPlace] = useState<NormalizedPlace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string>("");

  // helper: find matching local place (to get description, etc.)
  const localFallback = allPlaces.find(
    (p) => String(p.id) === idParam
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      // if we *only* have a pure local place id, we can short-circuit
      if (!navigator.geolocation) {
        await fetchFromApi("/api/places");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          await fetchFromApi(`/api/places?lat=${lat}&lng=${lng}`);
        },
        async () => {
          // permission denied or failed
          await fetchFromApi("/api/places");
        },
        { timeout: 5000 }
      );
    }

    async function fetchFromApi(url: string) {
      try {
        const res = await fetch(url);
        const json = (await res.json()) as PlacesResponse;

        if (!json.success) throw new Error("API returned success = false");

        if (cancelled) return;

        setSource(json.source);

        const match =
          json.data.find((p) => String(p.id) === idParam) ?? null;

        if (match) {
          setPlace(match);
        } else if (localFallback) {
          // if not in API results but we have a local mock, use that
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
        } else {
          setError("Place not found.");
        }
      } catch (err) {
        console.error("Failed to load place detail", err);
        if (!cancelled) {
          // fall back purely to local mock if we have one
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
          } else {
            setError("Could not load this place. Please try again.");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idParam]);

  // merge in description if this is a local mock place
  let description: string | undefined;
  if (place?.source === "local" && localFallback?.description) {
    description = localFallback.description;
  }

  // build a Google Maps URL if we can
  let mapsUrl: string | null = null;
  if (place?.lat != null && place?.lng != null) {
    mapsUrl = `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
  } else if (place?.address) {
    mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      place.address
    )}`;
  }

  if (loading) {
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
        <p className="text-slate-400 text-sm">
          {error || "Place not found."}
        </p>
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

          {(place.distanceMiles != null ||
            place.openUntil ||
            place.rating != null) && (
            <p className="text-slate-300 text-xs mb-1 space-x-1">
              {place.distanceMiles != null && (
                <span>{place.distanceMiles.toFixed(1)} mi</span>
              )}
              {place.rating != null && (
                <span>• ⭐ {place.rating.toFixed(1)}</span>
              )}
              {place.reviews != null && (
                <span>({place.reviews} reviews)</span>
              )}
              {place.openUntil && (
                <span>• open until {place.openUntil}</span>
              )}
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

      {/* Concierge booking micro-form (unchanged) */}
      <PlaceBookForm placeId={String(place.id)} placeName={place.name} />
    </main>
  );
}
