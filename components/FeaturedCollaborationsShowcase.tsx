"use client";

import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getCachedImageUrl } from "@/lib/imageProxy";
import type { FeaturedCollaborationsShowcaseData } from "@/lib/loadFeaturedCollaborations";

type Lang = "el" | "en";

const COPY = {
  el: { with: "με" },
  en: { with: "with" },
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
  const txt = COPY[lang];

  const cardById = useMemo(() => new Map(data.cards.map((c) => [c.applicationId, c])), [data.cards]);
  const active = cardById.get(activeId) ?? data.cards[0];
  const thumbnails = data.cards.filter((c) => c.applicationId !== active.applicationId);

  const decorSrc = data.decorativeCoverUrl
    ? getCachedImageUrl(data.decorativeCoverUrl) ?? data.decorativeCoverUrl
    : null;

  const onPickThumb = useCallback((applicationId: string) => {
    setActiveId(applicationId);
  }, []);

  return (
    <div className="relative overflow-visible">
      {decorSrc ? (
        <div
          className="pointer-events-none absolute -top-4 -right-4 lg:-top-6 lg:-right-6 z-0 hidden lg:block w-[34%] max-w-[220px] rotate-6"
          aria-hidden
        >
          <Image
            src={decorSrc}
            alt=""
            width={732}
            height={412}
            className="w-full h-auto rounded-xl shadow-lg ring-2 ring-white/80 object-cover"
            sizes="220px"
          />
        </div>
      ) : null}

      <div className="relative z-[1] rounded-2xl md:rounded-3xl bg-[#F7F7F7] p-4 sm:p-5 md:p-6 overflow-hidden">
        <div className="relative flex flex-col lg:grid lg:grid-cols-[minmax(0,58%)_minmax(0,42%)] gap-4 lg:gap-5 lg:items-stretch">
          <div className="relative w-full max-w-md mx-auto lg:max-w-none lg:mx-0">
            <div className="relative aspect-[9/16] w-full rounded-xl md:rounded-2xl overflow-hidden bg-slate-900">
              <video
                key={active.applicationId}
                className="absolute inset-0 w-full h-full object-cover"
                src={active.playUrl}
                poster={active.posterUrl ?? undefined}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
              />
              <CreatorLinkOverlay name={active.influencerName} href={active.influencerProfileHref} />
              <div className="absolute top-3 left-3">
                <BrandBadge brandName={data.brandName} brandLogoUrl={data.brandLogoUrl} />
              </div>
            </div>
          </div>

          {thumbnails.length > 0 ? (
            <div className="flex flex-row gap-3 overflow-x-auto pb-1 -mx-1 px-1 lg:flex-col lg:overflow-visible lg:pb-0 lg:mx-0 lg:px-0 lg:h-full lg:min-h-0">
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