import { accountsWithoutHiddenTopPosts } from "@/lib/hiddenVideos";

export type TopPostType = "video" | "image" | "carousel";

export type TopPost = {
  url: string;
  type: TopPostType;
  likes: number | null;
  comments: number | null;
  views: number | null;
  posted_at: string | null;
  platform?: string;
};

const ALLOWED_TYPES = new Set<TopPostType>(["video", "image", "carousel"]);

/** Saved on each account by admin refresh and the 15-day job (shown posts + backups). */
export const TOP_POSTS_PER_ACCOUNT = 6;
/** Shown and self-hosted on the profile, across every account. Always 3 slots. */
export const TOP_POSTS_DISPLAY_LIMIT = 3;

export type TopPostPlatform = "instagram" | "tiktok" | "youtube";

/** Instagram and TikTok top posts are self-hosted. YouTube stays an official embed. */
export const HOSTED_TOP_POST_PLATFORMS: readonly TopPostPlatform[] = ["instagram", "tiktok"];

const ALLOWED_HOST_SUFFIXES = ["instagram.com", "tiktok.com", "youtube.com", "youtu.be"] as const;

/** Map scraper type aliases (reel, short, sidecar, photo…) onto our three types. */
const TYPE_ALIASES: Record<string, TopPostType> = {
  reel: "video", reels: "video", clip: "video", clips: "video", short: "video", shorts: "video", igtv: "video",
  photo: "image", picture: "image", graphimage: "image",
  sidecar: "carousel", album: "carousel", graphsidecar: "carousel", slideshow: "carousel",
};

function parseCount(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value));
  const s = String(value).trim().replace(/,/g, "");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.round(n));
}

function parsePostedAt(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return null;
    const ms = Date.parse(t);
    if (!Number.isFinite(ms)) return t;
    return new Date(ms).toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value;
    return new Date(ms).toISOString();
  }
  return null;
}

/** True for https URLs on instagram.com / tiktok.com / youtube.com (incl. subdomains). */
export function isAllowedTopPostUrl(url: string): boolean {
  try {
    const u = new URL(String(url || "").trim());
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return ALLOWED_HOST_SUFFIXES.some(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`)
    );
  } catch {
    return false;
  }
}

/**
 * Keep only safe fields from Auditpr top_posts. Drops non-https / non-allowed hosts.
 * Keeps the first 3 valid posts in the order Auditpr sent them.
 * Returns [] for non-arrays (caller decides whether to wipe stored posts).
 */
export function sanitizeTopPosts(raw: unknown): TopPost[] {
  if (!Array.isArray(raw)) return [];
  const out: TopPost[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const src = item as Record<string, unknown>;
    const url = typeof src.url === "string" ? src.url.trim() : "";
    if (!url || !isAllowedTopPostUrl(url)) continue;
    const typeIn = String(src.type || "").toLowerCase().replace(/[^a-z]/g, "");
    const typeRaw = TYPE_ALIASES[typeIn] ?? typeIn;
    if (!ALLOWED_TYPES.has(typeRaw as TopPostType)) continue;
    out.push({
      url,
      type: typeRaw as TopPostType,
      likes: parseCount(src.likes),
      comments: parseCount(src.comments),
      views: parseCount(src.views),
      posted_at: parsePostedAt(src.posted_at),
    });
    if (out.length >= TOP_POSTS_PER_ACCOUNT) break;
  }
  return out;
}

function engagementScore(post: TopPost): number {
  return (post.likes ?? 0) + (post.comments ?? 0);
}

function compareTopPosts(a: TopPost, b: TopPost): number {
  const aViews = a.views;
  const bViews = b.views;
  const aHasViews = aViews != null && aViews > 0;
  const bHasViews = bViews != null && bViews > 0;
  if (aHasViews && bHasViews) return (bViews as number) - (aViews as number);
  if (aHasViews && !bHasViews) return -1;
  if (!aHasViews && bHasViews) return 1;
  return engagementScore(b) - engagementScore(a);
}

export type AccountWithTopPosts = {
  platform?: string;
  top_posts?: unknown;
};

export function topPostPlatformKey(
  url: string,
  accountPlatform?: string | null
): TopPostPlatform | null {
  const n = String(url || "").toLowerCase();
  if (/tiktok\.com|vm\.tiktok/.test(n)) return "tiktok";
  if (/instagram\.com|instagr\.am/.test(n)) return "instagram";
  if (/youtube\.com|youtu\.be/.test(n)) return "youtube";
  const p = String(accountPlatform || "").toLowerCase();
  if (p.includes("tiktok")) return "tiktok";
  if (p.includes("instagram")) return "instagram";
  if (p.includes("youtube")) return "youtube";
  return null;
}

export function isHostedTopPostPlatform(platform: TopPostPlatform | null): boolean {
  return platform === "instagram" || platform === "tiktok";
}

/**
 * Always fill `limit` slots (default 3):
 *   1. The best post of each platform (Instagram, TikTok, YouTube), ranked
 *      by views, else likes+comments.
 *   2. If the creator has fewer platforms, fill remaining slots with the
 *      next-best posts overall from the platforms they do have.
 * Hidden URLs are skipped first. A URL that is also in the portfolio still
 * occupies one of these slots (the file is stored once). YouTube is included
 * in this list for display as an official embed; it is not self-hosted.
 */
export function collectTopPosts(
  accounts: AccountWithTopPosts[] | null | undefined,
  limit = TOP_POSTS_DISPLAY_LIMIT,
  hiddenRaw?: unknown
): TopPost[] {
  if (!Array.isArray(accounts) || !accounts.length) return [];
  const visible = accountsWithoutHiddenTopPosts(accounts, hiddenRaw);
  const source = Array.isArray(visible) ? (visible as AccountWithTopPosts[]) : [];
  const byUrl = new Map<string, TopPost>();
  for (const acc of source) {
    const accountPlatform = typeof acc?.platform === "string" ? acc.platform : undefined;
    for (const raw of sanitizeTopPosts(acc?.top_posts)) {
      const platformLabel = accountPlatform || topPostPlatformKey(raw.url, accountPlatform) || undefined;
      const post = platformLabel ? { ...raw, platform: platformLabel } : raw;
      const prev = byUrl.get(post.url);
      if (!prev || compareTopPosts(post, prev) < 0) byUrl.set(post.url, post);
    }
  }
  const all = [...byUrl.values()];
  const cap = Math.max(0, limit);
  if (!all.length || cap === 0) return [];

  const byPlatform = new Map<string, TopPost[]>();
  for (const post of all) {
    const key = topPostPlatformKey(post.url, post.platform);
    if (!key) continue;
    const list = byPlatform.get(key) || [];
    list.push(post);
    byPlatform.set(key, list);
  }
  for (const list of byPlatform.values()) list.sort(compareTopPosts);

  const out: TopPost[] = [];
  const seen = new Set<string>();
  const winners = [...byPlatform.values()]
    .map((list) => list[0])
    .filter(Boolean)
    .sort(compareTopPosts);
  for (const post of winners) {
    if (seen.has(post.url)) continue;
    seen.add(post.url);
    out.push(post);
    if (out.length >= cap) return out;
  }

  const rest = all.filter((post) => !seen.has(post.url)).sort(compareTopPosts);
  for (const post of rest) {
    seen.add(post.url);
    out.push(post);
    if (out.length >= cap) break;
  }
  return out;
}

/** Display slots that should be self-hosted (Instagram and TikTok only). */
export function collectTopPostsToHost(
  accounts: AccountWithTopPosts[] | null | undefined,
  limit = TOP_POSTS_DISPLAY_LIMIT,
  hiddenRaw?: unknown
): TopPost[] {
  return collectTopPosts(accounts, limit, hiddenRaw).filter((post) =>
    isHostedTopPostPlatform(topPostPlatformKey(post.url, post.platform))
  );
}

/** Compact count for UI: 12500 → "12.5K" (caller may localize the decimal). */
export function formatCompactCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value < 0) return "—";
  const n = Math.round(value);
  if (n >= 1_000_000) {
    const s = (n / 1_000_000).toFixed(1).replace(/\.0$/, "");
    return `${s}M`;
  }
  if (n >= 1_000) {
    const s = (n / 1_000).toFixed(1).replace(/\.0$/, "");
    return `${s}K`;
  }
  return String(n);
}
