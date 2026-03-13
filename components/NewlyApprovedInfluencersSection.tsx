"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCachedImageUrl } from "@/lib/imageProxy";
import { isDefinitelyImage } from "@/lib/videoThumbnail";
import { categoryTranslations } from "@/components/categoryTranslations";
import { displayNameForLang } from "@/lib/greeklish";
import { getBadges, getBadgeStyles, type Badge } from "@/lib/badges";
import { getVisitorId } from "@/lib/visitorId";

type Lang = "el" | "en";

/** Raw row from API (select *), same shape as Directory source. */
export type NewlyApprovedInfluencer = {
  id: string;
  display_name: string;
  display_name_en?: string | null;
  avatar_url: string | null;
  videos?: string[] | null;
  video_thumbnails?: Record<string, string> | null;
  accounts?: Array<{ platform?: string; username?: string; followers?: string; engagement_rate?: string }> | null;
  category?: string | null;
  verified?: boolean;
  analytics_verified?: boolean;
  created_at?: string | null;
  engagement_rate?: string | Record<string, string> | null;
  avg_likes?: string | Record<string, string> | null;
  past_brands?: unknown[] | number | null;
  total_reviews?: number | null;
  avg_rating?: number | null;
  min_rate?: string | null;
};

function getBestImageUrl(inf: NewlyApprovedInfluencer): string | null {
  const videos = inf.videos && Array.isArray(inf.videos) ? inf.videos : [];
  for (const v of videos) {
    if (v && isDefinitelyImage(v)) return v;
  }
  const firstVideo = videos[0];
  if (firstVideo) {
    const thumb = inf.video_thumbnails?.[firstVideo];
    if (thumb) return thumb;
    if (/youtube\.com|youtu\.be/i.test(firstVideo)) {
      const m = firstVideo.match(/(?:v=|\/)([^"&?\/\s]{11})/);
      if (m) return `https://img.youtube.com/vi/${m[1]}/maxresdefault.jpg`;
    }
  }
  return inf.avatar_url || null;
}

function formatNum(num?: number): string {
  if (num === undefined || num === null) return "";
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "k";
  return num.toString();
}

function parseFollowers(acc: { followers?: string }): number {
  const s = String(acc.followers || "").toLowerCase().replace(/\s/g, "").replace(/,/g, "");
  if (!s) return 0;
  if (s.includes("m")) return parseFloat(s) * 1000000;
  if (s.includes("k") || s.includes("κ")) return parseFloat(s) * 1000;
  return parseFloat(s) || 0;
}

function getTotalFollowers(accounts: NewlyApprovedInfluencer["accounts"]): number {
  if (!Array.isArray(accounts)) return 0;
  return accounts.reduce((sum, a) => sum + parseFollowers(a), 0);
}

function parseFollowerString(s?: string): number {
  const str = String(s ?? "").toLowerCase().replace(/\s/g, "").replace(/,/g, "");
  if (!str) return 0;
  if (str.includes("m")) return Math.round(parseFloat(str) * 1000000);
  if (str.includes("k") || str.includes("κ")) return Math.round(parseFloat(str) * 1000);
  return parseInt(str, 10) || 0;
}

function buildFollowers(accounts: NewlyApprovedInfluencer["accounts"]): { [key: string]: number } {
  const out: { [key: string]: number } = {};
  if (!Array.isArray(accounts)) return out;
  accounts.forEach((acc) => {
    const platform = (acc.platform || "").toLowerCase();
    if (platform) out[platform] = parseFollowerString(acc.followers);
  });
  return out;
}

function getAccountAgeDays(createdAt?: string | null): number {
  if (!createdAt) return 999;
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
}

/** Same badge logic as Directory: build metrics from raw row, then getBadges. */
function getPrimaryBadge(inf: NewlyApprovedInfluencer, lang: Lang): Badge | { type: string; label: string; icon: string; bgColor: string; color: string } {
  const engagementRatesObj: { [key: string]: string } = {};
  if (Array.isArray(inf.accounts)) {
    inf.accounts.forEach((acc) => {
      const key = (acc.platform || "").toLowerCase();
      if (key && acc.engagement_rate) engagementRatesObj[key] = acc.engagement_rate;
    });
  }
  const engagementRate =
    Object.keys(engagementRatesObj).length > 0 ? engagementRatesObj : (inf.engagement_rate as Record<string, string> | string) || undefined;
  const verified = inf.analytics_verified ?? inf.verified ?? false;
  const badges = getBadges(
    {
      verified,
      followers: buildFollowers(inf.accounts),
      engagement_rate: engagementRate,
      total_reviews: inf.total_reviews ?? 0,
      avg_rating: inf.avg_rating ?? 0,
      past_brands: Array.isArray(inf.past_brands) ? inf.past_brands.length : (inf.past_brands as number) ?? 0,
      account_created_days: getAccountAgeDays(inf.created_at),
      min_rate: inf.min_rate ?? undefined,
    },
    lang
  );
  const nonVerified = badges.find((b) => b.type !== "verified");
  if (nonVerified) return nonVerified;
  return {
    type: "new",
    label: lang === "el" ? "Νέος" : "New",
    icon: "✨",
    bgColor: "bg-blue-50 border-blue-200",
    color: "text-blue-700",
  };
}

const t = {
  el: {
    badge: "Νέοι στο δίκτυο",
    title: "Νεοί Εγκεκριμένοι Creators",
    subtitle: "Επαληθευμένοι creators που μόλις εντάχθηκαν στην πλατφόρμα. Όλοι έχουν λάβει έγκριση και είναι έτοιμοι για συνεργασίες.",
    viewProfile: "Προφίλ",
    viewAll: "Δείτε όλο τον κατάλογο",
    empty: "Οι νεοί εγκεκριμένοι creators θα εμφανίζονται εδώ μετά την έγκρισή τους από την πλατφόρμα.",
  },
  en: {
    badge: "New to the network",
    title: "Newly Approved Creators",
    subtitle: "Verified creators who just joined the platform. All have been approved and are ready for collaborations.",
    viewProfile: "Profile",
    viewAll: "View full directory",
    empty: "Newly approved creators will appear here once they are approved by the platform.",
  },
};

export default function NewlyApprovedInfluencersSection({ lang }: { lang: Lang }) {
  const [influencers, setInfluencers] = useState<NewlyApprovedInfluencer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/influencers/newly-approved")
      .then((r) => {
        if (!r.ok) return { influencers: [] };
        return r.json();
      })
      .then((data) => {
        if (!cancelled && Array.isArray(data?.influencers)) setInfluencers(data.influencers);
      })
      .catch(() => {
        if (!cancelled) setInfluencers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <section className="relative py-16 md:py-20 px-6 bg-gradient-to-br from-slate-50 via-white to-blue-50/20 border-t border-slate-100">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="h-6 w-32 bg-slate-200 rounded-full animate-pulse mx-auto mb-4" />
            <div className="h-9 w-72 bg-slate-200 rounded animate-pulse mx-auto mb-3" />
            <div className="h-5 w-96 max-w-full bg-slate-100 rounded animate-pulse mx-auto" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="aspect-[4/5] rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  const txt = t[lang];

  return (
    <section className="relative py-16 md:py-20 px-6 bg-gradient-to-br from-slate-50 via-white to-blue-50/20 border-t border-slate-100" id="newly-approved">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 rounded-full mb-4">
            {txt.badge}
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">{txt.title}</h2>
          <p className="text-slate-600 max-w-2xl mx-auto mb-8">{txt.subtitle}</p>
        </div>

        {influencers.length === 0 ? (
          <div className="text-center py-12 px-6 bg-white/60 rounded-2xl border border-slate-200/80">
            <p className="text-slate-600 max-w-xl mx-auto mb-8">{txt.empty}</p>
            <a
              href="/directory"
              className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg"
            >
              {txt.viewAll}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
          </div>
        ) : (
        <>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
          {influencers.map((inf) => {
            if (!inf?.id) return null;
            const imgUrl = getBestImageUrl(inf);
            const name = displayNameForLang(
              (lang === "en" && inf.display_name_en ? inf.display_name_en : inf.display_name) ?? "",
              lang
            );
            const mainCat = inf.category
              ? (typeof inf.category === "string" && inf.category.includes(",") ? inf.category.split(",")[0].trim() : inf.category)
              : null;
            const catLabel = mainCat ? (categoryTranslations[mainCat]?.[lang] || mainCat) : null;
            const totalFol = getTotalFollowers(inf.accounts);

            return (
              <Link
                key={String(inf.id)}
                href={`/influencer/${inf.id}`}
                className="group block"
                onClick={() => {
                  fetch("/api/analytics/track", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      influencerId: inf.id,
                      eventType: "profile_click",
                      visitorId: getVisitorId(),
                      metadata: { source: "newly_approved" },
                    }),
                    keepalive: true
                  }).catch(() => {});
                }}
              >
                <article className="h-full bg-white rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all duration-300 group-hover:-translate-y-1">
                  <div className="relative aspect-[4/5] bg-slate-100 overflow-hidden">
                    {imgUrl ? (
                      <img
                        src={getCachedImageUrl(imgUrl) ?? imgUrl}
                        alt={name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                        onError={(e) => {
                          const el = e.currentTarget;
                          el.style.display = "none";
                          const fallback = el.nextElementSibling as HTMLElement | null;
                          if (fallback) fallback.style.display = "flex";
                        }}
                      />
                    ) : null}
                    <div
                      className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 text-slate-500 text-4xl"
                      style={{ display: imgUrl ? "none" : "flex" }}
                    >
                      {name?.charAt(0) || "?"}
                    </div>
                    {(() => {
                      const badge = getPrimaryBadge(inf, lang);
                      const badgeStyles = "priority" in badge && typeof badge.priority === "number"
                        ? getBadgeStyles(badge)
                        : `${badge.bgColor} ${badge.color} border px-2 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1`;
                      return (
                        <div className={`absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-full backdrop-blur-sm ${badgeStyles}`}>
                          <span className="text-[10px]">{badge.icon}</span>
                          <span>{badge.label}</span>
                        </div>
                      );
                    })()}
                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <h3 className="font-bold text-base md:text-lg leading-tight drop-shadow-md">{name}</h3>
                      {catLabel && (
                        <p className="text-xs md:text-sm text-white/90 mt-0.5">{catLabel}</p>
                      )}
                    </div>
                  </div>

                  <div className="px-4 py-3 flex items-center justify-between bg-slate-50/80 border-t border-slate-100">
                    <div className="text-slate-600">
                      {totalFol > 0 && (
                        <span className="text-sm font-semibold">{formatNum(totalFol)} followers</span>
                      )}
                    </div>
                    <span className="text-indigo-600 text-sm font-medium group-hover:underline">
                      {txt.viewProfile}
                    </span>
                  </div>
                </article>
              </Link>
            );
          })}
        </div>

        <div className="text-center mt-10">
          <a
            href="/directory"
            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg"
          >
            {txt.viewAll}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </div>
        </>
        )}
      </div>
    </section>
  );
}
