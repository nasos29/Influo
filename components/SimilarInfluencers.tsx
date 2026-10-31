"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import InfluencerCard from "@/components/InfluencerCard";
import { parseStoredCategories } from "@/lib/categories";
import { publicProfilePath } from "@/lib/profileSlug";
import { displayNameForLang } from "@/lib/greeklish";
import { parseFollowerString } from "@/lib/parseFollowers";
import type { SimilarInfluencerRow } from "@/lib/similarInfluencers";

const COPY = {
  titlePrefix: {
    el: "Influencers παρόμοιοι με",
    en: "Influencers similar to",
  },
  seeMore: { el: "Δες περισσότερους", en: "See more" },
  prev: { el: "Προηγούμενοι", en: "Previous" },
  next: { el: "Επόμενοι", en: "Next" },
} as const;

const scrollbarHide =
  "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

function directoryHrefFor(lang: "el" | "en", primaryCategory: string | null): string {
  const base = lang === "en" ? "/en/directory" : "/directory";
  if (!primaryCategory) return base;
  return `${base}?category=${encodeURIComponent(primaryCategory)}`;
}

function followersFromAccounts(
  accounts: SimilarInfluencerRow["accounts"]
): { [key: string]: number | undefined } {
  const out: { [key: string]: number | undefined } = {};
  if (!Array.isArray(accounts)) return out;
  for (const acc of accounts) {
    const key = String(acc?.platform || "")
      .trim()
      .toLowerCase();
    if (!key) continue;
    out[key] = parseFollowerString(acc?.followers);
  }
  return out;
}

function socialsFromAccounts(
  accounts: SimilarInfluencerRow["accounts"]
): { [key: string]: string | undefined } {
  const out: { [key: string]: string | undefined } = {};
  if (!Array.isArray(accounts)) return out;
  for (const acc of accounts) {
    const key = String(acc?.platform || "")
      .trim()
      .toLowerCase();
    const username = typeof acc?.username === "string" ? acc.username.trim() : "";
    if (!key || !username) continue;
    out[key] = username;
  }
  return out;
}

export default function SimilarInfluencers({
  influencerId,
  displayName,
  categories,
  platforms = [],
  lang,
}: Readonly<{
  influencerId: string;
  displayName: string;
  categories: string[];
  platforms?: string[];
  lang: "el" | "en";
}>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [items, setItems] = useState<SimilarInfluencerRow[] | null>(null);

  const cats = parseStoredCategories(categories);
  const catsKey = cats.join(",");
  const platformsKey = platforms
    .map((p) => String(p || "").trim().toLowerCase())
    .filter(Boolean)
    .join(",");
  const primaryCategory = cats[0] || null;
  const directoryHref = directoryHrefFor(lang, primaryCategory);
  const shownName = displayNameForLang(displayName || "", lang) || displayName || "";

  useEffect(() => {
    const node = rootRef.current;
    if (!node || near || (!catsKey && !platformsKey)) return;
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
  }, [near, catsKey, platformsKey]);

  useEffect(() => {
    if (!near || !influencerId || (!catsKey && !platformsKey)) return;

    let cancelled = false;
    void (async () => {
      try {
        const params = new URLSearchParams({ excludeId: influencerId });
        if (catsKey) params.set("categories", catsKey);
        if (platformsKey) params.set("platforms", platformsKey);
        const response = await fetch(`/api/influencers/similar?${params.toString()}`);
        const result = await response.json();
        if (cancelled) return;
        if (!response.ok || result.error) {
          console.warn("[SimilarInfluencers] query failed:", result.error || response.status);
          setItems([]);
          return;
        }
        const rows = Array.isArray(result.data) ? (result.data as SimilarInfluencerRow[]) : [];
        setItems(rows);
      } catch (err) {
        console.warn("[SimilarInfluencers] unexpected error:", err);
        if (!cancelled) setItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [near, influencerId, catsKey, platformsKey]);

  const scrollByCard = useCallback((dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-similar-card]");
    const step = card ? card.offsetWidth + 16 : el.clientWidth * 0.5;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }, []);

  if (!catsKey && !platformsKey) return null;

  const show = items && items.length > 0;
  if (items && !show) return null;

  return (
    <section ref={rootRef} className="max-w-6xl mx-auto px-4 sm:px-6 mt-10 mb-6">
      {!items ? (
        <div className="space-y-4" aria-hidden>
          <div className="h-7 w-64 max-w-full rounded-full bg-slate-100 animate-pulse" />
          <div className="flex gap-4 overflow-hidden">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-[45%] shrink-0 md:w-[calc((100%-3*1.5rem)/4)]"
              >
                <div className="aspect-[4/5] rounded-2xl bg-slate-100 animate-pulse" />
                <div className="mt-3 h-4 w-3/4 rounded bg-slate-100 animate-pulse" />
                <div className="mt-2 h-3 w-1/2 rounded bg-slate-100 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="min-w-0 text-lg font-bold text-slate-900 sm:text-xl md:text-2xl">
              <span className="block truncate">
                {COPY.titlePrefix[lang]} {shownName}
              </span>
            </h2>
            <div className="hidden shrink-0 items-center gap-2 md:flex">
              <button
                type="button"
                onClick={() => scrollByCard(-1)}
                aria-label={COPY.prev[lang]}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => scrollByCard(1)}
                aria-label={COPY.next[lang]}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          <div
            ref={scrollerRef}
            className={`flex gap-4 overflow-x-auto snap-x snap-mandatory pb-1 md:gap-6 ${scrollbarHide}`}
          >
            {items.map((row) => {
              const name =
                displayNameForLang(row.display_name || "", lang) || row.display_name || "";
              const href = publicProfilePath(row.profile_slug, row.id);
              const rowCats = parseStoredCategories(row.category);
              const followers = followersFromAccounts(row.accounts);
              const socials = socialsFromAccounts(row.accounts);
              const verified = row.analytics_verified === true || row.verified === true;

              return (
                <div
                  key={row.id}
                  data-similar-card
                  className="w-[45%] shrink-0 snap-start md:w-[calc((100%-3*1.5rem)/4)]"
                >
                  <Link href={href} className="block group">
                    <InfluencerCard
                      name={name}
                      avatar={row.avatar_url || ""}
                      verified={verified}
                      socials={socials}
                      followers={followers}
                      categories={rowCats}
                      lang={lang}
                      location={row.location}
                      price_tier={row.price_tier || "0"}
                    />
                  </Link>
                </div>
              );
            })}
          </div>

          {primaryCategory ? (
            <div className="mt-6 flex justify-center">
              <Link
                href={directoryHref}
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900"
              >
                {COPY.seeMore[lang]}
              </Link>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
