"use client";

import { useEffect, useState } from "react";
import { formatDisplayDate } from "@/lib/formatDate";

export type BrandReviewItem = {
  id: string;
  rating: number;
  review_text?: string | null;
  created_at?: string | null;
  influencer_name?: string | null;
};

function Stars({ rating }: { rating: number }) {
  const n = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return (
    <span className="inline-flex items-center gap-0.5 whitespace-nowrap" aria-label={`${n}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`text-sm ${i <= n ? "text-amber-400" : "text-slate-300"}`}>
          ★
        </span>
      ))}
    </span>
  );
}

/** Public list of creator→brand reviews (avg + count + texts). */
export default function BrandReviewsList({
  brandId,
  avgRating,
  totalReviews,
  lang = "el",
  compact = false,
}: {
  brandId?: string | null;
  avgRating?: number | null;
  totalReviews?: number | null;
  lang?: "el" | "en";
  compact?: boolean;
}) {
  const el = lang !== "en";
  const [reviews, setReviews] = useState<BrandReviewItem[]>([]);
  const [avg, setAvg] = useState<number>(Number(avgRating) || 0);
  const [total, setTotal] = useState<number>(Number(totalReviews) || 0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(!compact);

  useEffect(() => {
    setAvg(Number(avgRating) || 0);
    setTotal(Number(totalReviews) || 0);
  }, [avgRating, totalReviews]);

  useEffect(() => {
    if (!brandId || !open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/reviews/brand?brandId=${encodeURIComponent(brandId)}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (Array.isArray(data.reviews)) setReviews(data.reviews);
        if (typeof data.avg_rating === "number") setAvg(data.avg_rating);
        if (typeof data.total_reviews === "number") setTotal(data.total_reviews);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [brandId, open]);

  if (total <= 0 && avg <= 0) {
    if (compact) return null;
    if (!brandId) return null;
  }

  const summary =
    total > 0 ? (
      <div className="flex items-center gap-2 text-sm text-slate-700">
        <Stars rating={avg} />
        <span className="font-semibold tabular-nums">{avg.toFixed(1)}</span>
        <span className="text-slate-500">
          ({total} {el ? (total === 1 ? "αξιολόγηση" : "αξιολογήσεις") : total === 1 ? "review" : "reviews"})
        </span>
      </div>
    ) : (
      <p className="text-xs text-slate-400">{el ? "Χωρίς αξιολογήσεις ακόμη" : "No reviews yet"}</p>
    );

  if (compact) {
    if (total <= 0) return null;
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          {summary}
          {brandId ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen((v) => !v);
              }}
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              {open ? (el ? "Απόκρυψη" : "Hide") : el ? "Κείμενα" : "Texts"}
            </button>
          ) : null}
        </div>
        {open && brandId ? (
          loading ? (
            <p className="text-xs text-slate-400">{el ? "Φόρτωση…" : "Loading…"}</p>
          ) : (
            <ul className="space-y-2">
              {reviews.map((r) => (
                <li key={r.id} className="rounded-lg border border-slate-100 bg-slate-50/80 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800 truncate">
                      {r.influencer_name || (el ? "Creator" : "Creator")}
                    </span>
                    <Stars rating={r.rating} />
                  </div>
                  {r.review_text ? (
                    <p className="mt-1 text-xs text-slate-700 whitespace-pre-wrap break-words">{r.review_text}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {el ? "Αξιολογήσεις" : "Reviews"}
      </p>
      {summary}
      {loading ? (
        <p className="text-xs text-slate-400">{el ? "Φόρτωση…" : "Loading…"}</p>
      ) : reviews.length === 0 ? null : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {r.influencer_name || (el ? "Creator" : "Creator")}
                  </p>
                  {r.created_at ? (
                    <p className="text-xs text-slate-500">{formatDisplayDate(r.created_at)}</p>
                  ) : null}
                </div>
                <Stars rating={r.rating} />
              </div>
              {r.review_text ? (
                <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap break-words">{r.review_text}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
