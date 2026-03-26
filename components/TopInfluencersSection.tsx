"use client";

import { useEffect, useRef, useState, type TouchEvent } from "react";
import Link from "next/link";
import { getCachedImageUrl } from "@/lib/imageProxy";
import { isDefinitelyImage } from "@/lib/videoThumbnail";
import { categoryTranslations } from "@/components/categoryTranslations";
import { displayNameForLang } from "@/lib/greeklish";
import { getVisitorId } from "@/lib/visitorId";

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
    title: "Top 10 Influencers",
    subtitle: "Οι πιο δημοφιλείς creators βάσει αλληλεπίδρασης στο Influo",
    views: "προβολές",
  },
  en: {
    title: "Top 10 Influencers",
    subtitle: "Most popular creators based on engagement on Influo",
    views: "views",
  },
};

export default function TopInfluencersSection({ lang }: { lang: Lang }) {
  const [influencers, setInfluencers] = useState<TopInfluencer[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [autoplayEnabled, setAutoplayEnabled] = useState(false);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [cardsPerSlide, setCardsPerSlide] = useState(1);
  const touchStartXRef = useRef<number | null>(null);
  const touchEndXRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/top-influencers")
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

  useEffect(() => {
    const timer = window.setTimeout(() => setAutoplayEnabled(true), 5000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateCardsPerSlide = () => {
      const w = window.innerWidth;
      if (w >= 1024) setCardsPerSlide(5); // desktop
      else if (w >= 768) setCardsPerSlide(3); // tablet
      else setCardsPerSlide(1); // mobile
    };
    updateCardsPerSlide();
    window.addEventListener("resize", updateCardsPerSlide);
    return () => window.removeEventListener("resize", updateCardsPerSlide);
  }, []);

  const topTen = influencers.slice(0, 10);
  const slides: TopInfluencer[][] = [];
  for (let i = 0; i < topTen.length; i += cardsPerSlide) {
    slides.push(topTen.slice(i, i + cardsPerSlide));
  }

  useEffect(() => {
    if (slides.length === 0) return;
    if (currentIndex >= slides.length) setCurrentIndex(0);
  }, [currentIndex, slides.length]);

  useEffect(() => {
    if (!autoplayEnabled || hoverPaused || slides.length <= 1) return;
    const id = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 5500);
    return () => window.clearInterval(id);
  }, [autoplayEnabled, hoverPaused, slides.length]);

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

  const goPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const goNext = () => {
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  };

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
    touchEndXRef.current = null;
  };

  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    touchEndXRef.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = () => {
    const start = touchStartXRef.current;
    const end = touchEndXRef.current;
    if (start === null || end === null) return;
    const delta = end - start;
    const threshold = 50;
    if (delta > threshold && slides.length > 1) {
      goPrev();
    } else if (delta < -threshold && slides.length > 1) {
      goNext();
    }
    touchStartXRef.current = null;
    touchEndXRef.current = null;
  };

  return (
    <section className="relative py-16 md:py-24 px-6 bg-white border-b border-slate-100">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 rounded-full mb-4">
            Trending
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">{txt.title}</h2>
          <p className="text-slate-600 max-w-xl mx-auto">{txt.subtitle}</p>
        </div>

        <div
          className="relative max-w-7xl mx-auto"
          onMouseEnter={() => setHoverPaused(true)}
          onMouseLeave={() => setHoverPaused(false)}
        >
          <div
            className="overflow-hidden rounded-2xl touch-pan-y"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div
              className="flex transition-transform duration-700 ease-out"
              style={{ transform: `translateX(-${currentIndex * 100}%)` }}
            >
              {slides.map((slide, pageIdx) => (
                <div key={pageIdx} className="w-full shrink-0">
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 md:gap-8">
                    {slide.map((inf, idx) => {
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
            const rank = pageIdx * cardsPerSlide + idx + 1;

              return (
                <div key={String(inf.id)} className="w-full">
                  <Link
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
                    {/* Rank badge */}
                    <div
                      className="absolute top-3 left-3 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white bg-slate-900/80 backdrop-blur-sm"
                      aria-hidden
                    >
                      #{rank}
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
                    </div>
                    <span className="text-blue-600 text-sm font-medium group-hover:underline">
                      {lang === "el" ? "Προφίλ" : "Profile"}
                    </span>
                  </div>
                    </article>
                  </Link>
                </div>
              );
            })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {slides.length > 1 && (
            <>
              <button
                onClick={goPrev}
                aria-label={lang === "el" ? "Προηγούμενο" : "Previous"}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/90 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-white shadow-sm transition"
              >
                ←
              </button>
              <button
                onClick={goNext}
                aria-label={lang === "el" ? "Επόμενο" : "Next"}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/90 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-white shadow-sm transition"
              >
                →
              </button>
              <div className="flex justify-center gap-1.5 mt-4">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentIndex(i)}
                    aria-label={`${lang === "el" ? "Μετάβαση στο" : "Go to"} ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all ${i === currentIndex ? "w-5 bg-slate-700" : "w-1.5 bg-slate-300"}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
