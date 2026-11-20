"use client";

import { useMemo, useState } from "react";
import ReviewsSummaryModal, { type ReviewListItem } from "@/components/ReviewsSummaryModal";

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

/** Public creator reviews: avg + stars + count inline; full list in modal (matches brands). */
export default function CreatorReviewsList({
  avgRating,
  totalReviews,
  reviews,
  lang = "el",
}: {
  avgRating: number;
  totalReviews: number;
  reviews: Array<{
    id: string;
    rating: number;
    review_text?: string | null;
    created_at?: string | null;
    brand_name?: string | null;
  }>;
  lang?: "el" | "en";
}) {
  const el = lang !== "en";
  const [modalOpen, setModalOpen] = useState(false);
  // Fall back to the loaded list when the stored aggregate is stale (0 while reviews exist).
  const listAvg = reviews.length
    ? reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / reviews.length
    : 0;
  const total = Number(totalReviews) || reviews.length;
  const avg = Number(avgRating) || listAvg;

  const listItems = useMemo<ReviewListItem[]>(
    () =>
      reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        review_text: r.review_text,
        created_at: r.created_at,
        brand_name: r.brand_name,
      })),
    [reviews]
  );

  if (total <= 0 || avg <= 0) {
    return (
      <p className="text-center py-12 text-slate-400 text-lg">
        {el ? "Δεν υπάρχουν αξιολογήσεις ακόμα." : "No reviews yet."}
      </p>
    );
  }

  const summary = (
    <div className="flex items-center gap-2 text-sm text-slate-700">
      <Stars rating={avg} />
      <span className="font-semibold tabular-nums">{avg.toFixed(1)}</span>
      <span className="text-slate-500">
        ({total}{" "}
        {el ? (total === 1 ? "αξιολόγηση" : "αξιολογήσεις") : total === 1 ? "review" : "reviews"})
      </span>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-left hover:bg-slate-50"
      >
        {summary}
        <span className="text-xs font-semibold text-blue-600 shrink-0">{el ? "Όλες" : "All"}</span>
      </button>
      <ReviewsSummaryModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        lang={lang}
        avgRating={avg}
        totalReviews={total}
        reviews={listItems}
        loading={false}
        title={el ? "Αξιολογήσεις creator" : "Creator reviews"}
      />
    </>
  );
}