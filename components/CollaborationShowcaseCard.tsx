"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { CSSProperties } from "react";
import HostedMediaPlayer from "@/components/HostedMediaPlayer";
import PlatformBrandIcon from "@/components/PlatformBrandIcon";
import { getCachedImageUrl } from "@/lib/imageProxy";
import { displayServiceType } from "@/lib/campaignServiceLabel";
import { formatDisplayDate } from "@/lib/formatDate";
import type { RecentCollaborationCard } from "@/lib/loadRecentCollaborations";

const SocialEmbedCard = dynamic(() => import("@/components/SocialEmbedCard"), {
  ssr: false,
  loading: () => (
    <div className="aspect-[9/16] w-full animate-pulse rounded-xl bg-slate-100" aria-hidden />
  ),
});

type Lang = "el" | "en";

export type CollaborationShowcaseVariant = "showcase" | "listing";

const PLATFORM_LABEL: Record<NonNullable<RecentCollaborationCard["postProvider"]>, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

const SHOWCASE_COPY = {
  el: {
    reported: "δηλωμένα",
    views: "προβολές",
    reach: "reach",
    openPost: "Άνοιγμα post",
  },
  en: {
    reported: "self-reported",
    views: "views",
    reach: "reach",
    openPost: "Open post",
  },
} as const;

const PLACEHOLDER_COPY = {
  el: "Το βίντεο της συνεργασίας προετοιμάζεται.",
  en: "Collaboration video is being prepared.",
  preparing: { el: "Προετοιμασία βίντεο…", en: "Preparing video…" },
} as const;

const PENDING_GRADIENT: Record<"instagram" | "tiktok", string> = {
  instagram: "from-purple-600 to-pink-600",
  tiktok: "from-black to-gray-900",
};

/** 9/16 media shell. Height is capped; width shrinks so the frame stays 9/16. */
export const COLLABORATION_MEDIA_ASPECT = "9 / 16" as const;

const COLLABORATION_MEDIA_MAX_HEIGHT = "min(72vh, 520px)";

/** Width follows the height cap so a full-bleed 9/16 frame cannot grow past it. */
const COLLABORATION_MEDIA_MAX_WIDTH = `min(100%, calc(${COLLABORATION_MEDIA_MAX_HEIGHT} * 9 / 16))`;

export const COLLABORATION_MEDIA_SHELL_STYLE: CSSProperties = {
  aspectRatio: COLLABORATION_MEDIA_ASPECT,
  width: COLLABORATION_MEDIA_MAX_WIDTH,
  maxHeight: COLLABORATION_MEDIA_MAX_HEIGHT,
};

function Avatar({
  src,
  name,
  size,
  rounded = "full",
}: {
  src: string | null;
  name: string;
  size: number;
  rounded?: "full" | "lg";
}) {
  const proxied = src ? getCachedImageUrl(src) : null;
  const radius = rounded === "lg" ? "rounded-lg" : "rounded-full";
  if (proxied) {
    return (
      <Image
        src={proxied}
        alt={rounded === "lg" ? name : ""}
        width={size}
        height={size}
        className={`h-full w-full object-cover ${radius}`}
        loading="lazy"
        unoptimized={proxied.startsWith("/api/image-proxy")}
      />
    );
  }
  return (
    <span
      className={`flex h-full w-full items-center justify-center bg-slate-200 text-sm font-semibold text-slate-600 ${radius}`}
      aria-hidden={rounded !== "lg"}
    >
      {(name || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

function ResultLine({
  item,
  lang,
}: {
  item: RecentCollaborationCard;
  lang: Lang;
}) {
  const txt = SHOWCASE_COPY[lang];
  const locale = lang === "el" ? "el-GR" : "en-GB";
  const parts: string[] = [];
  if (item.selfReportedViews != null) {
    parts.push(`${item.selfReportedViews.toLocaleString(locale)} ${txt.views}`);
  }
  if (item.selfReportedReach != null) {
    parts.push(`${item.selfReportedReach.toLocaleString(locale)} ${txt.reach}`);
  }
  if (!parts.length) return null;
  return (
    <p className="text-xs text-slate-500">
      {parts.join(" · ")}{" "}
      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
        {txt.reported}
      </span>
    </p>
  );
}

function ListingHostedMedia({ item, lang }: { item: RecentCollaborationCard; lang: Lang }) {
  const shellClass = "relative mx-auto overflow-hidden rounded-t-2xl bg-slate-950";

  if (item.hostedMedia) {
    return (
      <div className={shellClass} style={COLLABORATION_MEDIA_SHELL_STYLE}>
        <HostedMediaPlayer media={item.hostedMedia} lang={lang} autoplayOnMount={false} />
      </div>
    );
  }

  if (item.postProvider === "instagram" || item.postProvider === "tiktok") {
    const provider = item.postProvider;
    return (
      <div
        className={`${shellClass} bg-slate-100`}
        style={COLLABORATION_MEDIA_SHELL_STYLE}
      >
        <div
          className={`absolute inset-0 bg-gradient-to-br ${PENDING_GRADIENT[provider]} opacity-15`}
          aria-hidden
        />
        <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
          <PlatformBrandIcon platform={provider} className="h-12 w-12 text-slate-400/80" />
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/75 to-transparent px-3 pb-3 pt-10">
          <PlatformBrandIcon platform={provider} className="h-5 w-5 shrink-0 text-white" />
          <p className="text-xs font-medium text-white">{PLACEHOLDER_COPY.preparing[lang]}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${shellClass} flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 px-6 text-center`}
      style={COLLABORATION_MEDIA_SHELL_STYLE}
    >
      <p className="text-sm font-medium text-slate-600">{PLACEHOLDER_COPY[lang]}</p>
    </div>
  );
}

function ShowcaseEmbedMedia({ item, lang }: { item: RecentCollaborationCard; lang: Lang }) {
  return (
    <div className="relative bg-slate-50">
      <div className="relative mx-auto overflow-hidden" style={COLLABORATION_MEDIA_SHELL_STYLE}>
        <div className="absolute inset-0">
          {item.postUrl && item.postProvider ? (
            <SocialEmbedCard
              provider={item.postProvider}
              originalUrl={item.postUrl}
              lang={lang}
              hostedMedia={item.hostedMedia ?? null}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-sm text-slate-500">
              {item.brandName}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CollaborationShowcaseCard({
  item,
  lang,
  variant = "listing",
}: {
  item: RecentCollaborationCard;
  lang: Lang;
  variant?: CollaborationShowcaseVariant;
}) {
  const categoryLabel = item.category
    ? displayServiceType(item.category, lang) || item.category
    : null;
  const platform = item.postProvider ? PLATFORM_LABEL[item.postProvider] : null;
  const dateLabel = item.completedAt ? formatDisplayDate(item.completedAt) : "";
  const showcaseTxt = SHOWCASE_COPY[lang];
  const bodyGap = variant === "listing" ? "gap-4 p-4 md:p-5" : "gap-3 p-4";

  return (
    <article className="flex h-full w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow duration-200 hover:shadow-md">
      <div className="relative">
        {variant === "showcase" ? (
          <ShowcaseEmbedMedia item={item} lang={lang} />
        ) : (
          <ListingHostedMedia item={item} lang={lang} />
        )}
        {platform ? (
          <span
            className={`pointer-events-none absolute left-3 top-3 rounded-md px-2 py-1 text-[11px] font-semibold tracking-wide text-slate-800 shadow-sm backdrop-blur-sm ring-1 ${
              variant === "showcase"
                ? "bg-white/60 ring-white/40"
                : "bg-white/75 ring-white/50"
            }`}
          >
            {platform}
          </span>
        ) : null}
      </div>

      <div className={`flex flex-1 flex-col ${bodyGap}`}>
        <div className="flex items-center gap-3">
          <div
            className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white"
            aria-hidden={variant === "listing"}
          >
            <Avatar src={item.brandLogoUrl} name={item.brandName} size={44} rounded="lg" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900">{item.brandName}</p>
            {categoryLabel ? (
              <p className="truncate text-xs text-slate-500">{categoryLabel}</p>
            ) : null}
          </div>
        </div>

        <Link
          href={item.influencerProfileHref}
          className={`flex min-w-0 items-center gap-3 rounded-lg outline-offset-2 hover:bg-slate-50 ${
            variant === "listing"
              ? "transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400"
              : ""
          }`}
        >
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-slate-100" aria-hidden={variant === "listing"}>
            <Avatar src={item.influencerAvatarUrl} name={item.influencerName} size={40} />
          </div>
          <span
            className={`truncate font-medium text-slate-800 ${
              variant === "showcase" ? "hover:underline" : ""
            }`}
          >
            {item.influencerName}
          </span>
        </Link>

        {variant === "showcase" ? (
          <div className="mt-auto space-y-2">
            <ResultLine item={item} lang={lang} />
            {item.postUrl ? (
              <a
                href={item.postUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex text-xs font-medium text-slate-600 underline-offset-2 hover:underline"
              >
                {showcaseTxt.openPost}
              </a>
            ) : null}
          </div>
        ) : dateLabel ? (
          <p className="mt-auto text-xs text-slate-500">
            <time dateTime={item.completedAt ?? undefined}>{dateLabel}</time>
          </p>
        ) : null}
      </div>
    </article>
  );
}