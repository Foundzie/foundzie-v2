// src/app/api/places/route.ts
import { NextResponse } from "next/server";
import { allPlaces } from "@/app/data/places";

export async function GET() {
  try {
    // simple delay for realism (simulate fetch)
    await new Promise((r) => setTimeout(r, 100));

    return NextResponse.json({
      success: true,
      count: allPlaces.length,
      data: allPlaces,
    });
  } catch (err) {
    console.error("Error fetching places:", err);
    return NextResponse.json(
      { success: false, message: "Failed to load places" },
      { status: 500 }
    );
  }
}