"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { sessionFetch } from "@/lib/sessionFetch";
import { formatDisplayDateTime } from "@/lib/formatDate";

type Lang = "el" | "en";

type ReviewDirection = "brand_to_creator" | "creator_to_brand" | "all";

type ReviewItem = {
  id: string;
  influencer_id: string;
  brand_email: string;
  brand_name: string | null;
  brand_id: string | null;
  rating: number;
  review_text: string | null;
  project_type: string | null;
  project_type_label: string | null;
  verified: boolean;
  created_at: string;
  direction: "brand_to_creator" | "creator_to_brand";
  reviewer_name: string;
  reviewed_name: string;
  creator_display_name: string;
  creator_profile_slug: string | null;
  creator_profile_path: string;
};

type Summary = {
  total: number;
  average_rating: number | null;
  by_direction: {
    brand_to_creator: { count: number; average_rating: number | null };
    creator_to_brand: { count: number; average_rating: number | null };
  };
};

const COPY = {
  el: {
    title: "Αξιολογήσεις πλατφόρμας",
    search: "Αναζήτηση",
    searchPh: "Όνομα, σχόλιο, email…",
    direction: "Κατεύθυνση",
    directionAll: "Όλες",
    directionB2C: "Επιχείρηση → Δημιουργός",
    directionC2B: "Δημιουργός → Επιχείρηση",
    rating: "Αστέρια",
    ratingAll: "Όλα",
    total: "Σύνολο",
    average: "Μέσος όρος",
    verified: "Επαληθευμένη",
    unverified: "Μη επαληθευμένη",
    reviewer: "Αξιολογητής",
    reviewed: "Αξιολογούμενος",
    comment: "Σχόλιο",
    profile: "Προφίλ δημιουργού",
    projectType: "Τύπος έργου",
    empty: "Δεν υπάρχουν αξιολογήσεις.",
    loadError: "Αποτυχία φόρτωσης.",
    b2cShort: "Επ. → Δημ.",
    c2bShort: "Δημ. → Επ.",
  },
  en: {
    title: "Platform reviews",
    search: "Search",
    searchPh: "Name, comment, email…",
    direction: "Direction",
    directionAll: "All",
    directionB2C: "Brand → Creator",
    directionC2B: "Creator → Brand",
    rating: "Stars",
    ratingAll: "All",
    total: "Total",
    average: "Average",
    verified: "Verified",
    unverified: "Unverified",
    reviewer: "Reviewer",
    reviewed: "Reviewed",
    comment: "Comment",
    profile: "Creator profile",
    projectType: "Project type",
    empty: "No reviews yet.",
    loadError: "Failed to load.",
    b2cShort: "B → C",
    c2bShort: "C → B",
  },
} as const;

function Stars({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) {
  const n = Math.min(5, Math.max(0, Math.round(rating)));
  const cls = size === "lg" ? "h-5 w-5" : "h-4 w-4";
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`${cls} ${i < n ? "fill-current" : "fill-none opacity-35"}`}
        />
      ))}
      <span className="ml-1 text-slate-700 text-sm font-medium tabular-nums">{rating}</span>
    </span>
  );
}

function directionLabel(
  direction: ReviewItem["direction"],
  lang: Lang,
  short = false
): string {
  const t = COPY[lang];
  if (direction === "brand_to_creator") {
    return short ? t.b2cShort : t.directionB2C;
  }
  return short ? t.c2bShort : t.directionC2B;
}

export default function AdminReviewsPanel({
  lang,
  onCount,
}: {
  lang: Lang;
  onCount?: (n: number) => void;
}) {
  const txt = COPY[lang];
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState<ReviewDirection>("all");
  const [ratingFilter, setRatingFilter] = useState<number | "all">("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (direction !== "all") params.set("direction", direction);
      if (ratingFilter !== "all") params.set("rating", String(ratingFilter));
      if (search.trim()) params.set("q", search.trim());
      const qs = params.toString();
      const res = await sessionFetch(`/api/admin/reviews${qs ? `?${qs}` : ""}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : txt.loadError);
        setItems([]);
        setSummary(null);
        return;
      }
      const next = Array.isArray(body.items) ? (body.items as ReviewItem[]) : [];
      setItems(next);
      if (body.summary && typeof body.summary === "object") {
        setSummary(body.summary as Summary);
      }
      if (typeof body.total === "number") {
        onCount?.(body.total);
      } else if (
        body.summary &&
        typeof (body.summary as Summary).total === "number" &&
        direction === "all" &&
        ratingFilter === "all" &&
        !search.trim()
      ) {
        onCount?.((body.summary as Summary).total);
      }
    } catch {
      setError(txt.loadError);
      setItems([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [direction, onCount, ratingFilter, search, txt.loadError]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), search ? 300 : 0);
    return () => window.clearTimeout(t);
  }, [load, search]);

  const displaySummary = useMemo(() => summary, [summary]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">{txt.title}</h2>

      {displaySummary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-500">{txt.total}</p>
            <p className="text-2xl font-semibold text-slate-900 tabular-nums">
              {displaySummary.total}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-500">{txt.average}</p>
            {displaySummary.average_rating != null ? (
              <Stars rating={displaySummary.average_rating} size="lg" />
            ) : (
              <p className="text-sm text-slate-500">—</p>
            )}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-medium text-slate-500">{txt.directionB2C}</p>
            <p className="text-lg font-semibold text-slate-900 tabular-nums">
              {displaySummary.by_direction.brand_to_creator.count}
            </p>
            {displaySummary.by_direction.brand_to_creator.average_rating != null ? (
              <Stars rating={displaySummary.by_direction.brand_to_creator.average_rating} />
            ) : null}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-medium text-slate-500">{txt.directionC2B}</p>
            <p className="text-lg font-semibold text-slate-900 tabular-nums">
              {displaySummary.by_direction.creator_to_brand.count}
            </p>
            {displaySummary.by_direction.creator_to_brand.average_rating != null ? (
              <Stars rating={displaySummary.by_direction.creator_to_brand.average_rating} />
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 min-w-[12rem] flex-1">
          {txt.search}
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={txt.searchPh}
            className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          {txt.direction}
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as ReviewDirection)}
            className="min-h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-800"
          >
            <option value="all">{txt.directionAll}</option>
            <option value="brand_to_creator">{txt.directionB2C}</option>
            <option value="creator_to_brand">{txt.directionC2B}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          {txt.rating}
          <select
            value={ratingFilter === "all" ? "all" : String(ratingFilter)}
            onChange={(e) => {
              const v = e.target.value;
              setRatingFilter(v === "all" ? "all" : Number(v));
            }}
            className="min-h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-800"
          >
            <option value="all">{txt.ratingAll}</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} ★
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">…</p>
      ) : error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-600">{txt.empty}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((row) => (
            <li
              key={row.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    <span className="sm:hidden">{directionLabel(row.direction, lang, true)}</span>
                    <span className="hidden sm:inline">{directionLabel(row.direction, lang)}</span>
                  </span>
                  <div>
                    <Stars rating={row.rating} size="lg" />
                  </div>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>{formatDisplayDateTime(row.created_at)}</p>
                  <p
                    className={
                      row.verified ? "text-emerald-700 font-medium" : "text-amber-700"
                    }
                  >
                    {row.verified ? txt.verified : txt.unverified}
                  </p>
                </div>
              </div>

              <p className="mt-2 text-sm text-slate-800">
                <span className="font-medium text-slate-600">{txt.reviewer}:</span>{" "}
                {row.reviewer_name}
                <span className="text-slate-400 mx-1">→</span>
                <span className="font-medium text-slate-600">{txt.reviewed}:</span>{" "}
                {row.reviewed_name}
              </p>

              {row.review_text ? (
                <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{row.review_text}</p>
              ) : (
                <p className="mt-2 text-sm text-slate-400 italic">—</p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                {row.project_type_label ? (
                  <span className="rounded-md border border-slate-200 px-2 py-1">
                    {txt.projectType}: {row.project_type_label}
                  </span>
                ) : null}
                <Link
                  href={row.creator_profile_path}
                  className="min-h-9 inline-flex items-center rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {txt.profile}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}