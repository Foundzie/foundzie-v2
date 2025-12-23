// src/app/api/places/route.ts
import { NextResponse } from "next/server";
import { recordPlacesSource } from "../health/store";
import { getPlaces, type InteractionMode } from "./store";

export const dynamic = "force-dynamic";

// GET /api/places?lat=&lng=&q=&mode=normal|child
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
    const result = await getPlaces({ lat, lng, q, mode });

    await recordPlacesSource(result.source);

    // tiny delay for realism (optional)
    await new Promise((r) => setTimeout(r, 80));

    return NextResponse.json({
      success: true,
      source: result.source,
      count: result.places.length,

      // ✅ compatibility: your tool expects `places`
      places: result.places,

      // ✅ backward compatibility: your UI may already use `data`
      data: result.places,
    });
  } catch (err) {
    console.error("Error in /api/places:", err);
    return NextResponse.json(
      { success: false, message: "Failed to load places" },
      { status: 500 }
    );
  }
}
