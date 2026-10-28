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

const ALLOWED_HOST_SUFFIXES = ["instagram.com", "tiktok.com", "youtube.com"] as const;

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
    const typeRaw = String(src.type || "").toLowerCase();
    if (!ALLOWED_TYPES.has(typeRaw as TopPostType)) continue;
    out.push({
      url,
      type: typeRaw as TopPostType,
      likes: parseCount(src.likes),
      comments: parseCount(src.comments),
      views: parseCount(src.views),
      posted_at: parsePostedAt(src.posted_at),
    });
    if (out.length >= 6) break;
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

/**
 * Collect top_posts from all accounts, sanitize, sort by views (else likes+comments),
 * return up to `limit` (default 6).
 */
export function collectTopPosts(
  accounts: AccountWithTopPosts[] | null | undefined,
  limit = 6
): TopPost[] {
  if (!Array.isArray(accounts) || !accounts.length) return [];
  const collected: TopPost[] = [];
  for (const acc of accounts) {
    const platform = typeof acc?.platform === "string" ? acc.platform : undefined;
    const posts = sanitizeTopPosts(acc?.top_posts);
    for (const post of posts) {
      collected.push(platform ? { ...post, platform } : post);
    }
  }
  collected.sort(compareTopPosts);
  return collected.slice(0, Math.max(0, limit));
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
