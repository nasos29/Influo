"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCachedImageUrl } from "@/lib/imageProxy";
import { isDefinitelyImage } from "@/lib/videoThumbnail";
import { categoryTranslations } from "@/components/categoryTranslations";
import { displayNameForLang } from "@/lib/greeklish";

type Lang = "el" | "en";

export type TopInfluencer = {
  id: string;
  display_name: string;
  display_name_en?: string | null;
  avatar_url: string | null;
  videos?: string[] | null;
  video_thumbnails?: Record<string, string> | null;
  accounts?: Array<{ platform?: string; username?: string; followers?: string }> | null;
  category?: string | null;
  clicks: number;
  views: number;
};

/** Pick largest/ best image: gallery image > video thumbnail > avatar */
function getBestImageUrl(inf: TopInfluencer): string | null {
  const videos = inf.videos && Array.isArray(inf.videos) ? inf.videos : [];
  for (const v of videos) {
    if (v && isDefinitelyImage(v)) return v;
  }
  const firstVideo = videos[0];
  if (firstVideo) {
    const thumb = inf.video_thumbnails?.[firstVideo];
    if (thumb) return thumb;
    // YouTube has direct thumbnail URL
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

function getTotalFollowers(accounts: TopInfluencer["accounts"]): number {
  if (!Array.isArray(accounts)) return 0;
  return accounts.reduce((sum, a) => sum + parseFollowers(a), 0);
}

const t = {
  el: {
    title: "Top Influencers του Μήνα",
    subtitle: "Οι πιο δημοφιλείς creators βάσει προβολών και κλικ",
    views: "προβολές",
  },
  en: {
    title: "Top Influencers of the Month",
    subtitle: "Most popular creators based on views and clicks",
    views: "views",
  },
};

export default function TopInfluencersSection({ lang }: { lang: Lang }) {
  const [influencers, setInfluencers] = useState<TopInfluencer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/top-influencers")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setInfluencers(data.influencers || []);
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
      <section className="relative py-16 md:py-24 px-6 bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900">{t[lang].title}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 md:gap-8">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="aspect-[4/5] rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (influencers.length === 0) return null;

  const txt = t[lang];

  return (
    <section className="relative py-16 md:py-24 px-6 bg-white border-b border-slate-100">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 rounded-full mb-4">
            {lang === "el" ? "Δημοφιλείς" : "Trending"}
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">{txt.title}</h2>
          <p className="text-slate-600 max-w-xl mx-auto">{txt.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 md:gap-8">
          {influencers.map((inf, idx) => {
            const imgUrl = getBestImageUrl(inf);
            const name = displayNameForLang(
              lang === "en" && inf.display_name_en ? inf.display_name_en : inf.display_name,
              lang
            );
            const mainCat = inf.category
              ? (inf.category.includes(",") ? inf.category.split(",")[0].trim() : inf.category)
              : null;
            const catLabel = mainCat ? (categoryTranslations[mainCat]?.[lang] || mainCat) : null;
            const totalFol = getTotalFollowers(inf.accounts);

            return (
              <Link
                key={inf.id}
                href={`/influencer/${inf.id}`}
                className="group block"
                onClick={() => {
                  fetch("/api/analytics/track", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      influencerId: inf.id,
                      eventType: "profile_click",
                      metadata: { source: "top_influencers" },
                    }),
                    keepalive: true
                  }).catch(() => {});
                }}
              >
                <article className="h-full bg-white rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm hover:shadow-xl hover:border-slate-300 transition-all duration-300 group-hover:-translate-y-1">
                  {/* Image - large gallery/thumbnail */}
                  <div className="relative aspect-[4/5] bg-slate-100 overflow-hidden">
                    {imgUrl ? (
                      <img
                        src={getCachedImageUrl(imgUrl) ?? imgUrl}
                        alt={name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                    />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 text-slate-500 text-4xl">
                        {name?.charAt(0) || "?"}
                      </div>
                    )}
                    {/* Rank badge */}
                    <div
                      className="absolute top-3 left-3 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white bg-slate-900/80 backdrop-blur-sm"
                      aria-hidden
                    >
                      #{idx + 1}
                    </div>
                    {/* Gradient overlay at bottom */}
                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
                    {/* Name & category overlay */}
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <h3 className="font-bold text-lg leading-tight drop-shadow-md">{name}</h3>
                      {catLabel && (
                        <p className="text-xs md:text-sm text-white/90 mt-0.5">{catLabel}</p>
                      )}
                    </div>
                  </div>

                  {/* Stats footer */}
                  <div className="px-4 py-4 flex items-center justify-between bg-slate-50/80 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-slate-600">
                      {totalFol > 0 && (
                        <span className="text-sm font-semibold">{formatNum(totalFol)} followers</span>
                      )}
                      {(inf.clicks > 0 || inf.views > 0) && (
                        <span className="text-xs text-slate-500">
                          {inf.clicks > 0 && `${inf.clicks} ${lang === "el" ? "κλικ" : "clicks"}`}
                          {inf.clicks > 0 && inf.views > 0 && " · "}
                          {inf.views > 0 && `${inf.views} ${txt.views}`}
                        </span>
                      )}
                    </div>
                    <span className="text-blue-600 text-sm font-medium group-hover:underline">
                      {lang === "el" ? "Προφίλ →" : "Profile →"}
                    </span>
                  </div>
                </article>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
