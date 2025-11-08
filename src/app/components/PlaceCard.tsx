// src/app/components/PlaceCard.tsx
import Link from "next/link";

type PlaceCardProps = {
  place: {
    id: string;
    name: string;
    category: string;
    distanceMiles?: number;
    rating?: number;
    reviews?: number;
    openUntil?: string;
    trending?: boolean;
    description?: string; // 👈 make it optional
  };
  href?: string; // in case this card is clickable
};

export default function PlaceCard({ place, href }: PlaceCardProps) {
  const content = (
    <div className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-white">{place.name}</p>
        {place.trending ? (
          <span className="text-[10px] bg-yellow-100 text-yellow-800 px-2 py-[1px] rounded">
            trending
          </span>
        ) : null}
      </div>

      <p className="text-xs text-slate-400 mt-0.5">{place.category}</p>

      {/* 👇 this line was failing because description didn't exist */}
      {place.description ? (
        <p className="text-xs text-slate-300 mt-1 line-clamp-1">
          {place.description}
        </p>
      ) : null}

      <p className="text-[11px] text-slate-400 mt-1">
        {typeof place.distanceMiles === "number"
          ? `${place.distanceMiles} mi`
          : ""}
        {typeof place.rating === "number" ? ` • ${place.rating.toFixed(1)} ★` : ""}
        {typeof place.reviews === "number" ? ` • ${place.reviews} reviews` : ""}
        {place.openUntil ? ` • open until ${place.openUntil}` : ""}
      </p>
    </div>
  );

  // if a link was passed, wrap it, otherwise just render the card
  return href ? (
    <Link href={href} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}