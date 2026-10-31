"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import InfluencerCard from "@/components/InfluencerCard";
import InfluencerCardCarousel, {
  INFLUENCER_CAROUSEL_CARD_CLASS,
} from "@/components/InfluencerCardCarousel";
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
} as const;

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

  if (!catsKey && !platformsKey) return null;

  const show = items && items.length > 0;
  if (items && !show) return null;

  return (
    <section ref={rootRef} className="max-w-6xl mx-auto px-4 sm:px-6 mt-10 mb-6">
      <InfluencerCardCarousel
        lang={lang}
        loading={!items}
        title={
          <>
            {COPY.titlePrefix[lang]} {shownName}
          </>
        }
        footer={
          primaryCategory && items ? (
            <div className="flex justify-center">
              <Link
                href={directoryHref}
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900"
              >
                {COPY.seeMore[lang]}
              </Link>
            </div>
          ) : null
        }
      >
        {(items || []).map((row) => {
          const name =
            displayNameForLang(row.display_name || "", lang) || row.display_name || "";
          const href = publicProfilePath(row.profile_slug, row.id);
          const rowCats = parseStoredCategories(row.category);
          const followers = followersFromAccounts(row.accounts);
          const socials = socialsFromAccounts(row.accounts);
          const verified = row.analytics_verified === true || row.verified === true;

          return (
            <div key={row.id} data-carousel-card className={INFLUENCER_CAROUSEL_CARD_CLASS}>
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
                  from_price={row.from_price}
                />
              </Link>
            </div>
          );
        })}
      </InfluencerCardCarousel>
    </section>
  );
}
