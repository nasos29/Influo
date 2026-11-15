"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { SECTION_TITLE_CLASS } from "@/lib/sectionTitle";
import type { RecentCollaborationCard } from "@/lib/loadRecentCollaborations";
import { getCachedImageUrl } from "@/lib/imageProxy";
import { formatDate } from "@/lib/formatDateTime";
import { displayServiceType } from "@/lib/campaignServiceLabel";

const SocialEmbedCard = dynamic(() => import("@/components/SocialEmbedCard"), {
  ssr: false,
  loading: () => (
    <div className="aspect-[4/5] w-full animate-pulse rounded-xl bg-slate-100" aria-hidden />
  ),
});

type Lang = "el" | "en";

const COPY = {
  el: {
    title: "Πρόσφατες συνεργασίες",
    subtitle: "Ολοκληρωμένες συνεργασίες brands και creators — μόνο με συναίνεση και των δύο.",
    reported: "δηλωμένα",
    views: "προβολές",
    reach: "reach",
    empty: "Σύντομα θα εμφανίζονται εδώ οι πρώτες δημόσιες συνεργασίες.",
  },
  en: {
    title: "Recent collaborations",
    subtitle: "Completed brand–creator partnerships — shown only with both parties’ consent.",
    reported: "self-reported",
    views: "views",
    reach: "reach",
    empty: "Public collaborations will appear here soon.",
  },
} as const;

function Stars({ rating }: { rating: number }) {
  const full = Math.round(Math.min(5, Math.max(0, rating)));
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500" aria-label={`${rating} / 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < full ? "opacity-100" : "opacity-25"}>
          ★
        </span>
      ))}
    </span>
  );
}

function Avatar({
  src,
  name,
  size,
}: {
  src: string | null;
  name: string;
  size: number;
}) {
  const proxied = src ? getCachedImageUrl(src) : null;
  if (proxied) {
    return (
      <Image
        src={proxied}
        alt=""
        width={size}
        height={size}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    );
  }
  return (
    <span className="flex h-full w-full items-center justify-center bg-slate-200 text-sm font-semibold text-slate-600">
      {(name || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

export default function RecentCollaborationsSection({
  items,
  lang,
  className = "",
}: {
  items: RecentCollaborationCard[];
  lang: Lang;
  className?: string;
}) {
  const txt = COPY[lang];
  if (!items.length) {
    return (
      <section className={`w-full max-w-page mx-auto px-6 py-12 md:py-16 ${className}`}>
        <h2 className={SECTION_TITLE_CLASS}>{txt.title}</h2>
        <p className="mt-2 max-w-2xl text-slate-600">{txt.subtitle}</p>
        <p className="mt-8 text-sm text-slate-500">{txt.empty}</p>
      </section>
    );
  }

  return (
    <section className={`w-full max-w-page mx-auto px-6 py-12 md:py-16 ${className}`}>
      <h2 className={SECTION_TITLE_CLASS}>{txt.title}</h2>
      <p className="mt-2 max-w-2xl text-slate-600">{txt.subtitle}</p>

      <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const categoryLabel = item.category
            ? displayServiceType(item.category, lang) || item.category
            : null;
          const dateLabel = formatDate(item.completedAt, lang);
          return (
            <li
              key={item.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="relative bg-slate-50">
                {item.postUrl && item.postProvider ? (
                  <div className="min-h-[220px]">
                    <SocialEmbedCard
                      provider={item.postProvider}
                      originalUrl={item.postUrl}
                      lang={lang}
                    />
                  </div>
                ) : (
                  <div className="flex aspect-[4/5] max-h-72 items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-sm text-slate-500">
                    {item.brandName}
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-white">
                    <Avatar src={item.brandLogoUrl} name={item.brandName} size={40} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{item.brandName}</p>
                    {categoryLabel ? (
                      <p className="truncate text-xs text-slate-500">{categoryLabel}</p>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    href={item.influencerProfileHref}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-lg outline-offset-2 hover:bg-slate-50"
                  >
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-slate-100">
                      <Avatar
                        src={item.influencerAvatarUrl}
                        name={item.influencerName}
                        size={40}
                      />
                    </div>
                    <span className="truncate font-medium text-slate-800 hover:underline">
                      {item.influencerName}
                    </span>
                  </Link>
                  {item.rating != null ? <Stars rating={item.rating} /> : null}
                </div>

                <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  {dateLabel ? <time dateTime={item.completedAt || undefined}>{dateLabel}</time> : null}
                  {item.selfReportedViews != null ? (
                    <span>
                      {item.selfReportedViews.toLocaleString(lang === "el" ? "el-GR" : "en-GB")}{" "}
                      {txt.views}{" "}
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                        {txt.reported}
                      </span>
                    </span>
                  ) : null}
                  {item.selfReportedReach != null ? (
                    <span>
                      {item.selfReportedReach.toLocaleString(lang === "el" ? "el-GR" : "en-GB")}{" "}
                      {txt.reach}{" "}
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                        {txt.reported}
                      </span>
                    </span>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
