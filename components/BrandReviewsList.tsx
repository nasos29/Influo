"use client";

import { useEffect, useState } from "react";
import ReviewsSummaryModal, { type ReviewListItem } from "@/components/ReviewsSummaryModal";

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
  const [modalOpen, setModalOpen] = useState(false);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    setAvg(Number(avgRating) || 0);
    setTotal(Number(totalReviews) || 0);
  }, [avgRating, totalReviews]);

  useEffect(() => {
    if (!brandId || !modalOpen || fetched) return;
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
        setFetched(true);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [brandId, modalOpen, fetched]);

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
      <>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setModalOpen(true);
          }}
          className="flex w-full items-center gap-2 text-left text-sm text-slate-700 hover:text-slate-900"
        >
          {summary}
          <span className="text-xs font-semibold text-blue-600 shrink-0">
            {el ? "Όλες" : "All"}
          </span>
        </button>
        <ReviewsSummaryModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          lang={lang}
          avgRating={avg}
          totalReviews={total}
          reviews={reviews as ReviewListItem[]}
          loading={loading && !fetched}
          title={el ? "Αξιολογήσεις επιχείρησης" : "Brand reviews"}
        />
      </>
    );
  }

  return (
    <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {el ? "Αξιολογήσεις" : "Reviews"}
      </p>
      {total > 0 ? (
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex w-full items-center gap-2 text-left hover:opacity-90"
        >
          {summary}
          <span className="text-xs font-semibold text-blue-600">{el ? "Όλες" : "All"}</span>
        </button>
      ) : (
        summary
      )}
      <ReviewsSummaryModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        lang={lang}
        avgRating={avg}
        totalReviews={total}
        reviews={reviews as ReviewListItem[]}
        loading={loading && !fetched}
        title={el ? "Αξιολογήσεις επιχείρησης" : "Brand reviews"}
      />
    </div>
  );
}
