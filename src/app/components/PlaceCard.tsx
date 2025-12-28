import Link from "next/link";
import { Star } from "lucide-react";

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
    address?: string | null;
  };
  href?: string;
};

export default function PlaceCard({ place, href }: PlaceCardProps) {
  const content = (
    <div
      className={[
        "rounded-2xl border border-slate-200 bg-white px-4 py-3",
        "shadow-[0_10px_24px_rgba(15,23,42,0.08)]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-slate-900 truncate">
            {place.name}
          </p>
          <p className="text-[12px] text-slate-600 mt-0.5">
            {place.category}
            {typeof place.distanceMiles === "number" ? (
              <span className="text-slate-500"> • {place.distanceMiles.toFixed(1)} mi</span>
            ) : null}
          </p>
        </div>

        {place.trending ? (
          <span className="shrink-0 text-[11px] font-semibold rounded-full bg-amber-50 text-amber-800 border border-amber-200 px-2 py-1">
            Trending
          </span>
        ) : null}
      </div>

      {place.description ? (
        <p className="text-[12px] text-slate-700 mt-2 line-clamp-2">
          {place.description}
        </p>
      ) : null}

      <div className="mt-2 flex items-center gap-2 text-[12px] text-slate-600">
        {typeof place.rating === "number" ? (
          <span className="inline-flex items-center gap-1">
            <Star size={14} className="text-amber-500" />
            {place.rating.toFixed(1)}
            {typeof place.reviews === "number" ? (
              <span className="text-slate-500">({place.reviews})</span>
            ) : null}
          </span>
        ) : null}

        {place.openUntil ? (
          <span className="text-slate-500">• Open until {place.openUntil}</span>
        ) : null}
      </div>

      {place.address ? (
        <p className="mt-2 text-[11px] text-slate-500 line-clamp-1">
          {place.address}
        </p>
      ) : null}
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
