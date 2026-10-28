"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SocialEmbedCard from "@/components/SocialEmbedCard";
import { detectProvider } from "@/lib/videoThumbnail";
import { useLazyVideoThumbnail } from "@/lib/useVideoThumbnail";
import {
  collectTopPosts,
  formatCompactCount,
  type TopPost,
} from "@/lib/topPosts";

const COPY = {
  title: { el: "Κορυφαία posts", en: "Top posts" },
  likes: { el: "Likes", en: "Likes" },
  views: { el: "Views", en: "Views" },
  comments: { el: "Σχόλια", en: "Comments" },
  play: { el: "Προβολή βίντεο", en: "Play video" },
  viewPhoto: { el: "Προβολή", en: "View" },
} as const;

type AccountLike = {
  platform?: string;
  top_posts?: unknown;
};

function localizeCompact(value: number | null | undefined, lang: "el" | "en"): string {
  const raw = formatCompactCount(value);
  if (lang === "el") return raw.replace(".", ",");
  return raw;
}

function formatPostedAt(iso: string | null | undefined, lang: "el" | "en"): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  try {
    return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "el-GR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(ms));
  } catch {
    return "";
  }
}

function platformLabel(platform: string | undefined, provider: string | null): string {
  const raw = (platform || provider || "").toLowerCase();
  if (raw.includes("instagram")) return "Instagram";
  if (raw.includes("tiktok")) return "TikTok";
  if (raw.includes("youtube")) return "YouTube";
  return provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : "";
}

function PlatformGlyph({ name }: { name: string }) {
  const lower = name.toLowerCase();
  if (lower === "instagram") {
    return (
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    );
  }
  if (lower === "tiktok") {
    return (
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
      </svg>
    );
  }
  if (lower === "youtube") {
    return (
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.5 31.5 0 0 0 24 12a31.5 31.5 0 0 0-.5-5.8zM9.8 15.5v-7l6.3 3.5-6.3 3.5z" />
      </svg>
    );
  }
  return null;
}

function MediaTypeBadge({
  type,
  label,
}: {
  type: TopPost["type"];
  label: string;
}) {
  if (type === "video") {
    return (
      <span
        className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
        aria-label={label}
      >
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow-lg">
          <svg viewBox="0 0 24 24" className="ml-0.5 h-6 w-6 fill-current" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </span>
    );
  }
  return (
    <span
      className="absolute top-2 right-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-black/55 text-white shadow-sm backdrop-blur-sm"
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
        <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5zm3 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-1 11 3.5-4.5 2.5 3 3.5-4.5L19 18H6z" />
      </svg>
    </span>
  );
}

function TopPostCard({
  post,
  lang,
}: {
  post: TopPost;
  lang: "el" | "en";
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [activated, setActivated] = useState(false);
  const provider = detectProvider(post.url);
  const { src: thumbSrc, onImgError } = useLazyVideoThumbnail(post.url, near && !activated);
  const label = platformLabel(post.platform, provider);
  const dateLabel = formatPostedAt(post.posted_at, lang);
  const isVideo = post.type === "video";
  const actionLabel = isVideo ? COPY.play[lang] : COPY.viewPhoto[lang];

  useEffect(() => {
    const node = rootRef.current;
    if (!node || near) return;
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
  }, [near]);

  const activate = useCallback(() => {
    if (!provider) return;
    setActivated(true);
  }, [provider]);

  if (activated && provider) {
    return (
      <div className="w-full">
        <SocialEmbedCard provider={provider} originalUrl={post.url} lang={lang} />
        <PostMeta post={post} lang={lang} dateLabel={dateLabel} />
      </div>
    );
  }

  return (
    <div ref={rootRef} className="w-full">
      <button
        type="button"
        onClick={activate}
        disabled={!provider}
        className="group relative block w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 text-left shadow-sm transition hover:border-blue-200 hover:shadow-md disabled:cursor-default"
        aria-label={actionLabel}
      >
        <div className="relative aspect-[4/5] w-full bg-gradient-to-br from-slate-200 to-slate-300">
          {thumbSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- CDN/proxy covers
            <img
              src={thumbSrc}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="absolute inset-0 h-full w-full object-cover"
              onError={onImgError}
            />
          ) : null}
          <MediaTypeBadge type={post.type} label={actionLabel} />
          {label ? (
            <span className="absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
              <PlatformGlyph name={label} />
              {label}
            </span>
          ) : null}
        </div>
      </button>
      <PostMeta post={post} lang={lang} dateLabel={dateLabel} />
    </div>
  );
}

function PostMeta({
  post,
  lang,
  dateLabel,
}: {
  post: TopPost;
  lang: "el" | "en";
  dateLabel: string;
}) {
  const stats: { key: string; text: string }[] = [];
  if (post.views != null && post.views > 0) {
    stats.push({
      key: "views",
      text: `${localizeCompact(post.views, lang)} ${COPY.views[lang]}`,
    });
  }
  if (post.likes != null && post.likes > 0) {
    stats.push({
      key: "likes",
      text: `${localizeCompact(post.likes, lang)} ${COPY.likes[lang]}`,
    });
  }
  if (post.comments != null && post.comments > 0) {
    stats.push({
      key: "comments",
      text: `${localizeCompact(post.comments, lang)} ${COPY.comments[lang]}`,
    });
  }

  return (
    <div className="mt-2 space-y-1 px-0.5">
      {stats.length > 0 ? (
        <p className="text-xs font-medium text-slate-700 tabular-nums">
          {stats.map((s) => s.text).join(" · ")}
        </p>
      ) : null}
      {dateLabel ? <p className="text-[11px] text-slate-400">{dateLabel}</p> : null}
    </div>
  );
}

export default function TopPosts({
  accounts,
  lang,
}: Readonly<{
  accounts?: AccountLike[] | null;
  lang: "el" | "en";
}>) {
  const posts = collectTopPosts(accounts, 6);
  if (!posts.length) return null;

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm md:p-6">
      <h2 className="mb-4 text-lg font-bold text-slate-900 md:text-xl">{COPY.title[lang]}</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        {posts.map((post) => (
          <TopPostCard key={post.url} post={post} lang={lang} />
        ))}
      </div>
    </section>
  );
}
