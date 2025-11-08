// src/app/admin/places/[id]/page.tsx
import { mockPlaces } from "@/app/data/places";

type AdminPlacePageProps = {
  // Vercel/Next is insisting this is a Promise, so we’ll match it
  params: Promise<{ id: string }>;
};

export default async function AdminPlacePage({ params }: AdminPlacePageProps) {
  const { id } = await params;

  const place = mockPlaces.find((p) => p.id === id);

  if (!place) {
    return (
      <main className="min-h-screen bg-slate-950 text-white p-6">
        <h1 className="text-2xl font-semibold mb-2">Place not found</h1>
        <p>This ID doesn’t exist in src/app/data/places.ts.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6 space-y-4">
      <h1 className="text-2xl font-semibold">{place.name}</h1>
      <p className="text-sm text-slate-300">{place.category}</p>

      <div className="bg-slate-900 rounded-lg p-4 space-y-2">
        <p className="text-sm">
          <span className="font-medium">Open until:</span> {place.openUntil}
        </p>
        <p className="text-sm">
          <span className="font-medium">Rating:</span> {place.rating}
        </p>
        <p className="text-sm">
          <span className="font-medium">Reviews:</span> {place.reviews}
        </p>
        <p className="text-sm">
          <span className="font-medium">Trending:</span>{" "}
          {place.trending ? "Yes" : "No"}
        </p>
        <p className="text-sm">
          <span className="font-medium">Distance:</span>{" "}
          {place.distanceMiles} mi
        </p>
        {place.description ? (
          <p className="text-sm mt-2">
            <span className="font-medium">Description:</span>{" "}
            {place.description}
          </p>
        ) : null}
      </div>
    </main>
  );
}