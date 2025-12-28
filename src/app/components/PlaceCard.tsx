import Link from "next/link";
import { Star, Flame, MapPin } from "lucide-react";

type PlaceCardProps = {
  place: {
    id: string | number;
    name: string;
    category: string;
    distanceMiles?: number;
    rating?: number;
    reviews?: number;
    openUntil?: string;
    trending?: boolean;
    description?: string;
  };
  href?: string;
};

export default function PlaceCard({ place, href }: PlaceCardProps) {
  const content = (
    <div className="fz-card px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-slate-900 truncate">
            {place.name}
          </p>
          <p className="text-[12px] text-slate-600 mt-0.5 truncate">
            {place.category}
          </p>
        </div>

        {place.trending ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 text-[11px] font-semibold">
            <Flame size={14} />
            Trending
          </span>
        ) : null}
      </div>

      {place.description ? (
        <p className="text-[12px] text-slate-700 mt-2 line-clamp-2">
          {place.description}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
        {typeof place.distanceMiles === "number" ? (
          <span className="inline-flex items-center gap-1">
            <MapPin size={14} />
            {place.distanceMiles.toFixed(1)} mi
          </span>
        ) : null}

        {typeof place.rating === "number" ? (
          <span className="inline-flex items-center gap-1">
            <Star size={14} />
            {place.rating.toFixed(1)}
            {typeof place.reviews === "number" ? (
              <span className="text-slate-500">({place.reviews})</span>
            ) : null}
          </span>
        ) : null}

        {place.openUntil ? (
          <span className="text-slate-500">Open until {place.openUntil}</span>
        ) : null}
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}
