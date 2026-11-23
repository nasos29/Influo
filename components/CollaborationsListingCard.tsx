"use client";

import Image from "next/image";
import Link from "next/link";
import HostedMediaPlayer from "@/components/HostedMediaPlayer";
import PlatformBrandIcon from "@/components/PlatformBrandIcon";
import VideoThumbnail from "@/components/VideoThumbnail";
import { getCachedImageUrl } from "@/lib/imageProxy";
import { displayServiceType } from "@/lib/campaignServiceLabel";
import { formatDisplayDate } from "@/lib/formatDate";
import type { RecentCollaborationCard } from "@/lib/loadRecentCollaborations";

type Lang = "el" | "en";

const PLATFORM_LABEL: Record<NonNullable<RecentCollaborationCard["postProvider"]>, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

const PLACEHOLDER_COPY = {
  el: "Το βίντεο της συνεργασίας προετοιμάζεται.",
  en: "Collaboration video is being prepared.",
  preparing: { el: "Προετοιμασία βίντεο…", en: "Preparing video…" },
} as const;

const PENDING_GRADIENT: Record<"instagram" | "tiktok", string> = {
  instagram: "from-purple-600 to-pink-600",
  tiktok: "from-black to-gray-900",
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
        alt=""
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
      aria-hidden
    >
      {(name || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

function mediaAspectRatio(provider: RecentCollaborationCard["postProvider"]): string {
  if (provider === "tiktok") return "9 / 16";
  if (provider === "youtube") return "16 / 9";
  return "4 / 5";
}

function ListingMedia({ item, lang }: { item: RecentCollaborationCard; lang: Lang }) {
  const aspect = mediaAspectRatio(item.postProvider);
  const shellClass =
    "relative w-full overflow-hidden rounded-t-2xl bg-slate-950";

  if (item.hostedMedia) {
    return (
      <div className={shellClass} style={{ aspectRatio: aspect, maxHeight: "min(72vh, 520px)" }}>
        <HostedMediaPlayer
          media={item.hostedMedia}
          lang={lang}
          autoplayOnMount={false}
        />
      </div>
    );
  }

  if (
    item.postUrl &&
    (item.postProvider === "instagram" || item.postProvider === "tiktok")
  ) {
    const provider = item.postProvider;
    return (
      <div
        className={`${shellClass} bg-slate-100`}
        style={{ aspectRatio: provider === "tiktok" ? "9 / 16" : "4 / 5", minHeight: 280 }}
      >
        <div
          className={`absolute inset-0 bg-gradient-to-br ${PENDING_GRADIENT[provider]} opacity-15`}
          aria-hidden
        />
        <VideoThumbnail url={item.postUrl} alt="" fill className="object-cover" />
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
      style={{ aspectRatio: aspect, minHeight: 280 }}
    >
      <p className="text-sm font-medium text-slate-600">
        {PLACEHOLDER_COPY[lang]}
      </p>
    </div>
  );
}

export default function CollaborationsListingCard({
  item,
  lang,
}: {
  item: RecentCollaborationCard;
  lang: Lang;
}) {
  const categoryLabel = item.category
    ? displayServiceType(item.category, lang) || item.category
    : null;
  const platform = item.postProvider ? PLATFORM_LABEL[item.postProvider] : null;
  const dateLabel = item.completedAt ? formatDisplayDate(item.completedAt) : "";

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow duration-200 hover:shadow-md">
      <div className="relative">
        <ListingMedia item={item} lang={lang} />
        {platform ? (
          <span className="pointer-events-none absolute left-3 top-3 rounded-md bg-white/75 px-2 py-1 text-[11px] font-semibold tracking-wide text-slate-800 shadow-sm backdrop-blur-sm ring-1 ring-white/50">
            {platform}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4 md:p-5">
        <div className="flex items-center gap-3">
          <div
            className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white"
            aria-hidden
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
          className="flex min-w-0 items-center gap-3 rounded-lg outline-offset-2 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400"
        >
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-slate-100" aria-hidden>
            <Avatar src={item.influencerAvatarUrl} name={item.influencerName} size={40} />
          </div>
          <span className="truncate font-medium text-slate-800">{item.influencerName}</span>
        </Link>

        {dateLabel ? (
          <p className="mt-auto text-xs text-slate-500">
            <time dateTime={item.completedAt ?? undefined}>{dateLabel}</time>
          </p>
        ) : null}
      </div>
    </article>
  );
}