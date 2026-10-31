/**
 * Portfolio links hidden from the public profile after consecutive unplayable checks.
 * Entries stay in influencers.videos; only visibility changes.
 */

import { normalizeVideoUrlKey } from "@/lib/checkVideoPlayable";

export type HiddenVideoEntry = {
  url: string;
  reason: string;
  hidden_at: string;
};

export function parseHiddenVideos(raw: unknown): HiddenVideoEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: HiddenVideoEntry[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const url = typeof rec.url === "string" ? rec.url.trim() : "";
    if (!url) continue;
    const key = normalizeVideoUrlKey(url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const reason = typeof rec.reason === "string" && rec.reason ? rec.reason : "unplayable";
    const hidden_at =
      typeof rec.hidden_at === "string" && rec.hidden_at
        ? rec.hidden_at
        : new Date().toISOString();
    out.push({ url, reason, hidden_at });
  }
  return out;
}

/** URLs (normalized keys) currently hidden. */
export function hiddenVideoKeySet(hidden: HiddenVideoEntry[]): Set<string> {
  return new Set(hidden.map((h) => normalizeVideoUrlKey(h.url)).filter(Boolean));
}

/** Public portfolio: drop hidden URLs, keep order of `videos`. */
export function visibleVideos(
  videos: unknown,
  hiddenRaw: unknown
): string[] {
  const list = Array.isArray(videos)
    ? videos.filter((u): u is string => typeof u === "string" && !!u.trim())
    : [];
  const hidden = hiddenVideoKeySet(parseHiddenVideos(hiddenRaw));
  if (!hidden.size) return list;
  return list.filter((u) => !hidden.has(normalizeVideoUrlKey(u)));
}

function topPostUrlKeys(accounts: unknown): string[] {
  if (!Array.isArray(accounts)) return [];
  const keys: string[] = [];
  for (const account of accounts) {
    if (!account || typeof account !== "object") continue;
    const posts = (account as { top_posts?: unknown }).top_posts;
    if (!Array.isArray(posts)) continue;
    for (const post of posts) {
      if (!post || typeof post !== "object") continue;
      const url = (post as { url?: unknown }).url;
      if (typeof url !== "string" || !url.trim()) continue;
      const key = normalizeVideoUrlKey(url);
      if (key) keys.push(key);
    }
  }
  return keys;
}

/** Public top posts: drop URLs hidden by the same unplayable check as portfolio. */
export function accountsWithoutHiddenTopPosts(accounts: unknown, hiddenRaw: unknown): unknown {
  if (!Array.isArray(accounts)) return accounts;
  const hidden = hiddenVideoKeySet(parseHiddenVideos(hiddenRaw));
  if (!hidden.size) return accounts;
  return accounts.map((account) => {
    if (!account || typeof account !== "object") return account;
    const posts = (account as { top_posts?: unknown }).top_posts;
    if (!Array.isArray(posts)) return account;
    const top_posts = posts.filter((post) => {
      if (!post || typeof post !== "object") return true;
      const url = (post as { url?: unknown }).url;
      if (typeof url !== "string") return true;
      return !hidden.has(normalizeVideoUrlKey(url));
    });
    return { ...(account as Record<string, unknown>), top_posts };
  });
}

/** Keep hidden entries that still exist in portfolio videos or top posts. */
export function syncHiddenVideosWithVideos(
  videos: unknown,
  hiddenRaw: unknown,
  accounts?: unknown
): HiddenVideoEntry[] {
  const keys = new Set(
    (Array.isArray(videos) ? videos : [])
      .filter((u): u is string => typeof u === "string" && !!u.trim())
      .map(normalizeVideoUrlKey)
  );
  for (const key of topPostUrlKeys(accounts)) keys.add(key);
  return parseHiddenVideos(hiddenRaw).filter((h) => keys.has(normalizeVideoUrlKey(h.url)));
}

export function upsertHiddenVideo(
  hiddenRaw: unknown,
  entry: HiddenVideoEntry
): HiddenVideoEntry[] {
  const list = parseHiddenVideos(hiddenRaw);
  const key = normalizeVideoUrlKey(entry.url);
  const next = list.filter((h) => normalizeVideoUrlKey(h.url) !== key);
  next.push(entry);
  return next;
}

export function removeHiddenVideo(hiddenRaw: unknown, url: string): HiddenVideoEntry[] {
  const key = normalizeVideoUrlKey(url);
  return parseHiddenVideos(hiddenRaw).filter((h) => normalizeVideoUrlKey(h.url) !== key);
}

export function countHiddenVideos(hiddenRaw: unknown): number {
  return parseHiddenVideos(hiddenRaw).length;
}
