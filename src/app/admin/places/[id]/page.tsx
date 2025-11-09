// src/app/admin/places/[id]/page.tsx
import Link from "next/link";
import { mockPlaces } from "@/app/data/places";

type PageProps = {
  params: {
    id: string; // Next gives us the route param as string
  };
};

export default function AdminPlaceDetailPage({ params }: PageProps) {
  const id = params.id;

  // 🔴 important part:
  // some old typing thinks p.id might be a number,
  // so we ALWAYS turn it into a string before comparing
  const place = mockPlaces.find((p) => p.id.toString() === id);

  // if id doesn't match anything, show a friendly message
  if (!place) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 p-6 space-y-4">
        <Link href="/admin/places" className="text-pink-400 underline text-sm">
          &lt; Back to places
        </Link>
        <h1 className="text-xl font-semibold">Place not found</h1>
        <p className="text-slate-400 text-sm">
          The ID <code className="text-pink-300">{id}</code> didn&apos;t match
          anything in <code>src/app/data/places.ts</code>.
        </p>
      </main>
    );
  }

  // normal detail view
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-6 space-y-6">
      <Link href="/admin/places" className="text-pink-400 underline text-sm">
        &lt; Back to places
      </Link>

      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{place.name}</h1>
          <p className="text-slate-400 text-sm">{place.category}</p>
        </div>
        <p className="text-sm text-slate-300">ID: {place.id}</p>
      </header>

      <section className="space-y-2 text-sm">
        <p>
          <span className="text-slate-400">Rating:</span>{" "}
          <span className="font-medium">{place.rating}</span>
        </p>
        <p>
          <span className="text-slate-400">Reviews:</span>{" "}
          <span className="font-medium">{place.reviews}</span>
        </p>
        <p>
          <span className="text-slate-400">Open until:</span>{" "}
          <span className="font-medium">{place.openUntil}</span>
        </p>
        <p>
          <span className="text-slate-400">Trending:</span>{" "}
          <span className="font-medium">{place.trending ? "Yes" : "No"}</span>
        </p>
      </section>

      {place.description ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Description</h2>
          <p className="text-slate-200 text-sm">{place.description}</p>
        </section>
      ) : null}
    </main>
  );
}