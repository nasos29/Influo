"use client";

import SocialEmbedCard from "@/components/SocialEmbedCard";
import { detectProvider } from "@/lib/videoThumbnail";
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

function TopPostCard({
  post,
  lang,
}: {
  post: TopPost;
  lang: "el" | "en";
}) {
  const provider = detectProvider(post.url);
  const dateLabel = formatPostedAt(post.posted_at, lang);
  if (!provider) return null;

  return (
    <div className="w-full min-w-0">
      <SocialEmbedCard provider={provider} originalUrl={post.url} lang={lang} />
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
  const posts = collectTopPosts(accounts);
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
