"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import { supabase } from "@/lib/supabaseClient";
import { categoryTranslations, parseStoredCategories } from "@/lib/categories";
import { publicProfilePath } from "@/lib/profileSlug";
import { displayNameForLang } from "@/lib/greeklish";
import {
  categoryIlikeOrFilter,
  followerTotalFromAccounts,
  pickSimilarInfluencers,
  type SimilarInfluencerRow,
} from "@/lib/similarInfluencers";

const COPY = {
  title: { el: "Σχετικοί influencers", en: "Similar influencers" },
  seeAll: { el: "Δες όλους στην κατηγορία", en: "See all in this category" },
  followers: { el: "Followers", en: "Followers" },
} as const;

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

function directoryHrefFor(lang: "el" | "en", primaryCategory: string | null): string {
  const base = lang === "en" ? "/en/directory" : "/directory";
  if (!primaryCategory) return base;
  return `${base}?category=${encodeURIComponent(primaryCategory)}`;
}

export default function SimilarInfluencers({
  influencerId,
  categories,
  lang,
}: Readonly<{
  influencerId: string;
  categories: string[];
  lang: "el" | "en";
}>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [items, setItems] = useState<SimilarInfluencerRow[] | null>(null);

  const cats = parseStoredCategories(categories);
  const catsKey = cats.join(",");
  const primaryCategory = cats[0] || null;
  const directoryHref = directoryHrefFor(lang, primaryCategory);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || near || !catsKey) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px", threshold: 0.01 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [near, catsKey]);

  useEffect(() => {
    if (!near || !catsKey || !influencerId) return;
    const currentCats = catsKey.split(",").filter(Boolean);
    const orFilter = categoryIlikeOrFilter(currentCats);
    if (!orFilter) return;

    let cancelled = false;
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("influencers")
          .select(
            "id, display_name, profile_slug, avatar_url, category, verified, accounts"
          )
          .eq("approved", true)
          .neq("id", influencerId)
          .or(orFilter)
          .limit(40);
        if (cancelled) return;
        if (error) {
          console.warn("[SimilarInfluencers] query failed:", error.message || error);
          setItems([]);
          return;
        }
        if (!data) {
          setItems([]);
          return;
        }
        const rows = (data as SimilarInfluencerRow[]).map((row) => ({
          ...row,
          id: String(row.id),
          accounts: Array.isArray(row.accounts) ? row.accounts : [],
        }));
        // Shuffle only here (client useEffect) — avoids SSR/hydration mismatch.
        setItems(pickSimilarInfluencers(influencerId, currentCats, rows, 6));
      } catch (err) {
        console.warn("[SimilarInfluencers] unexpected error:", err);
        if (!cancelled) setItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [near, influencerId, catsKey]);

  if (!catsKey) return null;

  const show = items && items.length > 0;
  if (items && !show) return null;

  return (
    <section ref={rootRef} className="max-w-6xl mx-auto px-6 mt-10 mb-4">
      {!items ? (
        <div className="h-24 rounded-2xl bg-slate-50 animate-pulse" aria-hidden />
      ) : (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5 md:p-6">
          <h2 className="text-lg md:text-xl font-bold text-slate-900 mb-4">
            {COPY.title[lang]}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {items.map((row) => {
              const name = displayNameForLang(row.display_name || "", lang) || row.display_name || "";
              const href = publicProfilePath(row.profile_slug, row.id);
              const rowCats = parseStoredCategories(row.category);
              const label =
                (rowCats[0] && categoryTranslations[rowCats[0]]?.[lang]) ||
                rowCats[0] ||
                "";
              const followers = followerTotalFromAccounts(row.accounts);
              return (
                <Link
                  key={row.id}
                  href={href}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3 hover:border-blue-200 hover:bg-blue-50/40 transition"
                >
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-slate-200">
                    <Avatar src={row.avatar_url || ""} alt={name} size={48} className="h-full w-full" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
                    {label ? (
                      <p className="truncate text-xs text-slate-500">{label}</p>
                    ) : null}
                    {followers > 0 ? (
                      <p className="text-xs text-slate-400">
                        {formatFollowers(followers)} {COPY.followers[lang]}
                      </p>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>
          {primaryCategory ? (
            <div className="mt-5 flex justify-center">
              <Link
                href={directoryHref}
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700 transition"
              >
                {COPY.seeAll[lang]}
              </Link>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
