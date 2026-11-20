"use client";

import { useEffect } from "react";
import { formatDisplayDate } from "@/lib/formatDate";

export type ReviewListItem = {
  id: string;
  rating: number;
  review_text?: string | null;
  created_at?: string | null;
  influencer_name?: string | null;
  brand_name?: string | null;
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

/** Modal listing reviews (avg + count in header). */
export default function ReviewsSummaryModal({
  open,
  onClose,
  lang = "el",
  avgRating,
  totalReviews,
  reviews,
  loading,
  title,
}: {
  open: boolean;
  onClose: () => void;
  lang?: "el" | "en";
  avgRating: number;
  totalReviews: number;
  reviews: ReviewListItem[];
  loading?: boolean;
  title?: string;
}) {
  const el = lang !== "en";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {title || (el ? "Αξιολογήσεις" : "Reviews")}
            </h2>
            {totalReviews > 0 ? (
              <div className="mt-1 flex items-center gap-2 text-sm text-slate-700">
                <Stars rating={avgRating} />
                <span className="font-semibold tabular-nums">{avgRating.toFixed(1)}</span>
                <span className="text-slate-500">
                  ({totalReviews}{" "}
                  {el ? (totalReviews === 1 ? "αξιολόγηση" : "αξιολογήσεις") : totalReviews === 1 ? "review" : "reviews"})
                </span>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-2xl text-slate-400 hover:bg-slate-100"
            aria-label={el ? "Κλείσιμο" : "Close"}
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-sm text-slate-500">{el ? "Φόρτωση…" : "Loading…"}</p>
          ) : reviews.length === 0 ? (
            <p className="text-sm text-slate-500">{el ? "Δεν υπάρχουν κείμενα αξιολογήσεων." : "No review texts yet."}</p>
          ) : (
            <ul className="space-y-3">
              {reviews.map((r) => (
                <li key={r.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {r.influencer_name || r.brand_name || (el ? "Αξιολόγηση" : "Review")}
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
      </div>
    </div>
  );
}