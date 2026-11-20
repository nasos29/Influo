"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getCachedImageUrl } from "@/lib/imageProxy";
import type { FeaturedCollaborationsShowcaseData } from "@/lib/loadFeaturedCollaborations";

type Lang = "el" | "en";

const COPY = {
  el: { with: "με", unmute: "Ήχος", mute: "Σίγαση" },
  en: { with: "with", unmute: "Sound", mute: "Mute" },
} as const;

type Props = {
  data: FeaturedCollaborationsShowcaseData;
  lang: Lang;
};

function BrandBadge({
  brandName,
  brandLogoUrl,
  className = "",
}: {
  brandName: string;
  brandLogoUrl: string | null;
  className?: string;
}) {
  const logo = brandLogoUrl ? getCachedImageUrl(brandLogoUrl) ?? brandLogoUrl : null;
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full bg-white/95 border border-slate-200/80 px-3 py-1.5 shadow-sm ${className}`}
    >
      {logo ? (
        <Image
          src={logo}
          alt=""
          width={28}
          height={28}
          className="w-7 h-7 rounded-full object-contain bg-white"
        />
      ) : (
        <span className="w-7 h-7 rounded-full bg-slate-100" aria-hidden />
      )}
      <span className="text-sm font-semibold text-slate-900 tracking-tight">{brandName}</span>
    </div>
  );
}

function CreatorLinkOverlay({ name, href }: { name: string; href: string }) {
  return (
    <div className="absolute inset-x-0 bottom-0 pt-16 pb-3 px-3 bg-gradient-to-t from-black/80 via-black/45 to-transparent pointer-events-none">
      <Link
        href={href}
        className="pointer-events-auto text-white text-sm font-semibold drop-shadow-sm hover:underline underline-offset-2"
      >
        {name}
      </Link>
    </div>
  );
}

function CreatorNameOverlay({ name }: { name: string }) {
  return (
    <div className="absolute inset-x-0 bottom-0 pt-16 pb-3 px-3 bg-gradient-to-t from-black/80 via-black/45 to-transparent pointer-events-none">
      <span className="text-white text-sm font-semibold drop-shadow-sm">{name}</span>
    </div>
  );
}

export default function FeaturedCollaborationsShowcase({ data, lang }: Props) {
  const [activeId, setActiveId] = useState(data.initialHeroApplicationId);
  const [heroMuted, setHeroMuted] = useState(true);
  const heroVideoRef = useRef<HTMLVideoElement>(null);
  const txt = COPY[lang];

  const cardById = useMemo(() => new Map(data.cards.map((c) => [c.applicationId, c])), [data.cards]);
  const active = cardById.get(activeId) ?? data.cards[0];
  const thumbnails = data.cards.filter((c) => c.applicationId !== active.applicationId);

  const onPickThumb = useCallback((applicationId: string) => {
    setActiveId(applicationId);
    setHeroMuted(true);
  }, []);

  useEffect(() => {
    setHeroMuted(true);
  }, [active.applicationId]);

  useEffect(() => {
    const el = heroVideoRef.current;
    if (!el) return;
    el.muted = heroMuted;
    if (!heroMuted) {
      void el.play().catch(() => {
        setHeroMuted(true);
      });
    }
  }, [heroMuted, active.applicationId]);

  const toggleHeroMute = useCallback(() => {
    setHeroMuted((m) => !m);
  }, []);

  return (
    <div className="relative">
      <div className="relative rounded-2xl md:rounded-3xl bg-[#F7F7F7] p-4 sm:p-5 md:p-6 overflow-hidden">
        <div className="relative mx-auto w-full max-w-[800px] flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,58%)_minmax(0,42%)] lg:gap-5 lg:items-stretch lg:max-h-[70vh] lg:h-[min(70vh,100%)]">
          <div className="relative flex justify-center min-h-0 lg:h-full lg:max-h-[70vh]">
            <div className="relative aspect-[9/16] w-full max-h-[min(70vh,28rem)] max-w-[min(100%,calc(min(70vh,28rem)*9/16))] lg:max-h-[70vh] lg:max-w-none lg:h-full lg:w-auto rounded-xl md:rounded-2xl overflow-hidden bg-slate-900">
              <video
                key={active.applicationId}
                ref={heroVideoRef}
                className="absolute inset-0 w-full h-full object-cover"
                src={active.playUrl}
                poster={active.posterUrl ?? undefined}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
              />
              <button
                type="button"
                className="absolute bottom-14 right-3 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/65 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                aria-label={heroMuted ? txt.unmute : txt.mute}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleHeroMute();
                }}
              >
                {heroMuted ? (
                  <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden>
                    <path d="M5 9v6h4l5 5V4L9 9H5zm12.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                    <path d="M3.27 3 2 4.27 6.73 9H5v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 3.27 3z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden>
                    <path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                  </svg>
                )}
              </button>
              <CreatorLinkOverlay name={active.influencerName} href={active.influencerProfileHref} />
              <div className="absolute top-3 left-3">
                <BrandBadge brandName={data.brandName} brandLogoUrl={data.brandLogoUrl} />
              </div>
            </div>
          </div>

          {thumbnails.length > 0 ? (
            <div className="flex flex-row gap-3 overflow-x-auto pb-1 -mx-1 px-1 lg:flex-col lg:overflow-visible lg:pb-0 lg:mx-0 lg:px-0 lg:h-full lg:max-h-[70vh] lg:min-h-0">
              {thumbnails.map((card) => (
                <button
                  key={card.applicationId}
                  type="button"
                  className="relative shrink-0 w-28 sm:w-32 aspect-[9/16] lg:w-full lg:flex-1 lg:aspect-auto lg:min-h-0 rounded-xl md:rounded-2xl overflow-hidden bg-slate-900 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
                  onClick={() => onPickThumb(card.applicationId)}
                  aria-label={card.influencerName}
                >
                  {card.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={card.posterUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="absolute inset-0 bg-slate-800" aria-hidden />
                  )}
                  <CreatorNameOverlay name={card.influencerName} />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <p className="sr-only">
          {data.brandName} {txt.with} Influo creators
        </p>
      </div>
    </div>
  );
}