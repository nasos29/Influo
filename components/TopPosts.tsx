"use client";

import { useEffect, useMemo, useState } from "react";
import SocialEmbedCard from "@/components/SocialEmbedCard";
import { detectProvider } from "@/lib/videoThumbnail";
import {
  collectTopPosts,
  formatCompactCount,
  TOP_POSTS_DISPLAY_LIMIT,
  type TopPost,
} from "@/lib/topPosts";
import { formatDisplayDate } from "@/lib/formatDate";
import type { HostedMedia } from "@/lib/creatorMedia";
import { lookupHostedMedia } from "@/lib/useCreatorMedia";
import HostedMediaPlayer from "@/components/HostedMediaPlayer";
import { filterTopPostsForHostedOnly } from "@/lib/topPostsHostedOnly";

const COPY = {
  title: { el: "Κορυφαία posts", en: "Top posts" },
  likes: { el: "Likes", en: "Likes" },
  views: { el: "Views", en: "Views" },
  comments: { el: "Σχόλια", en: "Comments" },
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

function formatPostedAt(iso: string | null | undefined, _lang: "el" | "en"): string {
  return formatDisplayDate(iso);
}

function hostedTopPostAspectRatio(hostedMedia: HostedMedia, provider: "instagram" | "tiktok"): string {
  if (hostedMedia.width && hostedMedia.height) {
    return `${hostedMedia.width} / ${hostedMedia.height}`;
  }
  return provider === "tiktok" ? "9 / 16" : "4 / 5";
}

function TopPostCard({
  post,
  lang,
  onUnavailable,
  hostedMedia,
  igTikTokHostedOnly,
}: {
  post: TopPost;
  lang: "el" | "en";
  onUnavailable: () => void;
  hostedMedia?: HostedMedia | null;
  igTikTokHostedOnly?: boolean;
}) {
  const provider = detectProvider(post.url);
  const dateLabel = formatPostedAt(post.posted_at, lang);
  if (!provider) return null;

  if (
    igTikTokHostedOnly &&
    (provider === "instagram" || provider === "tiktok") &&
    hostedMedia?.playUrl
  ) {
    const ratio = hostedTopPostAspectRatio(hostedMedia, provider);
    return (
      <div className="w-full min-w-0">
        <div
          className="relative mx-auto w-full max-w-[360px] overflow-hidden rounded-xl bg-black shadow-md"
          style={{ aspectRatio: ratio }}
        >
          <HostedMediaPlayer media={hostedMedia} lang={lang} autoplayOnMount={false} />
        </div>
        <PostMeta post={post} lang={lang} dateLabel={dateLabel} />
      </div>
    );
  }

  return (
    <div className="w-full min-w-0">
      <SocialEmbedCard
        provider={provider}
        originalUrl={post.url}
        lang={lang}
        onUnavailable={hostedMedia ? undefined : onUnavailable}
        hostedMedia={hostedMedia}
      />
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
  hostedByUrl,
  igTikTokHostedOnly = false,
}: Readonly<{
  accounts?: AccountLike[] | null;
  lang: "el" | "en";
  hostedByUrl?: Map<string, HostedMedia>;
  igTikTokHostedOnly?: boolean;
}>) {
  // 3 slots: best of each platform, then next-best overall. Collect a few
  // spares so an unavailable embed can be replaced by the next post.
  const candidates = useMemo(() => collectTopPosts(accounts, TOP_POSTS_DISPLAY_LIMIT * 3), [accounts]);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const candidateKey = candidates.map((p) => p.url).join("|");

  useEffect(() => {
    if (!candidateKey) return;
    const params = new URLSearchParams();
    for (const url of candidateKey.split("|")) params.append("u", url);
    let cancelled = false;
    if (!igTikTokHostedOnly) {
      fetch(`/api/top-posts/availability?${params.toString()}`)
        .then((res) => (res.ok ? res.json() : { unavailable: [] }))
        .then((data: { unavailable?: string[] }) => {
          if (cancelled || !Array.isArray(data.unavailable) || !data.unavailable.length) return;
          setHidden((prev) => new Set([...prev, ...data.unavailable!]));
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [candidateKey, igTikTokHostedOnly]);

  const posts = filterTopPostsForHostedOnly(
    candidates.filter(
      (p) => !hidden.has(p.url) || Boolean(hostedByUrl && lookupHostedMedia(hostedByUrl, p.url))
    ),
    hostedByUrl,
    igTikTokHostedOnly
  ).slice(0, TOP_POSTS_DISPLAY_LIMIT);
  if (!posts.length) return null;

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm md:p-6">
      <h2 className="mb-4 text-lg font-bold text-slate-900 md:text-xl">{COPY.title[lang]}</h2>
      <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-smooth px-5 pb-1 [-webkit-overflow-scrolling:touch] md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 md:pb-0">
        {posts.map((post) => (
          <div
            key={post.url}
            className="w-[85%] max-w-[85%] shrink-0 snap-start md:w-auto md:max-w-none md:shrink"
          >
            <TopPostCard
              post={post}
              lang={lang}
              igTikTokHostedOnly={igTikTokHostedOnly}
              hostedMedia={hostedByUrl ? lookupHostedMedia(hostedByUrl, post.url) : null}
              onUnavailable={() => setHidden((prev) => new Set(prev).add(post.url))}
            />
          </div>
        ))}
      </div>
    </section>
  );
}