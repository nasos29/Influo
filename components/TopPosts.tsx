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

function TopPostCard({
  post,
  lang,
  onUnavailable,
}: {
  post: TopPost;
  lang: "el" | "en";
  onUnavailable: () => void;
}) {
  const provider = detectProvider(post.url);
  const dateLabel = formatPostedAt(post.posted_at, lang);
  if (!provider) return null;

  return (
    <div className="w-full min-w-0">
      <SocialEmbedCard provider={provider} originalUrl={post.url} lang={lang} onUnavailable={onUnavailable} />
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
  // Collect a few spares so a removed post can be replaced by the next one.
  const candidates = useMemo(() => collectTopPosts(accounts, TOP_POSTS_DISPLAY_LIMIT * 3), [accounts]);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const candidateKey = candidates.map((p) => p.url).join("|");

  useEffect(() => {
    if (!candidateKey) return;
    const params = new URLSearchParams();
    for (const url of candidateKey.split("|")) params.append("u", url);
    let cancelled = false;
    fetch(`/api/top-posts/availability?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : { unavailable: [] }))
      .then((data: { unavailable?: string[] }) => {
        if (cancelled || !Array.isArray(data.unavailable) || !data.unavailable.length) return;
        setHidden((prev) => new Set([...prev, ...data.unavailable!]));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [candidateKey]);

  const posts = candidates.filter((p) => !hidden.has(p.url)).slice(0, TOP_POSTS_DISPLAY_LIMIT);
  if (!posts.length) return null;

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm md:p-6">
      <h2 className="mb-4 text-lg font-bold text-slate-900 md:text-xl">{COPY.title[lang]}</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        {posts.map((post) => (
          <TopPostCard
            key={post.url}
            post={post}
            lang={lang}
            onUnavailable={() => setHidden((prev) => new Set(prev).add(post.url))}
          />
        ))}
      </div>
    </section>
  );
}
