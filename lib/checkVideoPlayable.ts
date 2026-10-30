/**
 * Check whether a portfolio video URL can play inside Influo (no paid APIs).
 * Technical failures → playable:true + reason "unchecked" (do not block save).
 */

import { extractInstagramMedia } from "@/lib/instagramShortcode";
import { resolveInstagramEmbedVideo } from "@/lib/instagramEmbedVideo";
import { isTikTokShortLink } from "@/lib/tikTokPlayer";

const TIMEOUT_MS = 8000;
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export const VIDEO_NOT_PLAYABLE_ERROR = {
  el: "Αυτό το βίντεο δεν επιτρέπει αναπαραγωγή εκτός Instagram/TikTok (συνήθως λόγω μουσικής με δικαιώματα). Διάλεξε άλλο βίντεο.",
  en: "This video can't be played outside Instagram/TikTok (usually due to licensed music). Please choose another video.",
} as const;

export const VIDEO_CHECKING_LABEL = {
  el: "Έλεγχος…",
  en: "Checking…",
} as const;

export type VideoPlayableResult = {
  playable: boolean;
  reason?: string;
};

function youtubeVideoId(raw: string): string | null {
  const patterns = [
    /youtu\.be\/([A-Za-z0-9_-]{11})(?:[?#/]|$)/i,
    /youtube\.com\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})(?:[?#/]|$)/i,
    /[?&]v=([A-Za-z0-9_-]{11})(?:&|$)/i,
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function tikTokCanonicalFromAny(url: string): string | null {
  const withUser = url.match(/tiktok\.com\/@([\w.-]+)\/(video|photo)\/(\d+)/i);
  if (withUser?.[1] && withUser[2] && withUser[3]) {
    return `https://www.tiktok.com/@${withUser[1]}/${withUser[2].toLowerCase()}/${withUser[3]}`;
  }
  const bare = url.match(/tiktok\.com\/(video|photo)\/(\d+)/i);
  if (bare?.[1] && bare[2]) {
    return `https://www.tiktok.com/${bare[1].toLowerCase()}/${bare[2]}`;
  }
  return null;
}

/** Resolve vm/vt/t short links to a full TikTok URL (or null on technical failure). */
async function resolveTikTokUrl(url: string): Promise<
  | { ok: true; url: string }
  | { ok: false; technical: boolean; gone?: boolean }
> {
  const already = tikTokCanonicalFromAny(url);
  if (already) return { ok: true, url: already };
  if (!isTikTokShortLink(url) && !/tiktok\.com\/t\/[\w-]+/i.test(url)) {
    return { ok: true, url: url.split("?")[0].split("#")[0] };
  }

  try {
    let current = url.trim();
    for (let hop = 0; hop < 5; hop++) {
      let res: Response;
      try {
        res = await fetch(current, {
          method: "GET",
          redirect: "manual",
          signal: AbortSignal.timeout(TIMEOUT_MS),
          headers: { "User-Agent": BROWSER_UA },
        });
        try {
          await res.body?.cancel?.();
        } catch {
          /* ignore */
        }
      } catch {
        return { ok: false, technical: true };
      }
      if (res.status === 429 || res.status === 401 || res.status === 403 || res.status >= 500) {
        return { ok: false, technical: true };
      }
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return { ok: false, technical: true };
        current = new URL(loc, current).href;
        const resolved = tikTokCanonicalFromAny(current);
        if (resolved) return { ok: true, url: resolved };
        continue;
      }
      break;
    }
    const resolved = tikTokCanonicalFromAny(current);
    if (resolved) return { ok: true, url: resolved };
    try {
      const path = new URL(current).pathname;
      if (path === "/" || path === "") return { ok: false, technical: false, gone: true };
    } catch {
      return { ok: false, technical: true };
    }
    return { ok: false, technical: true };
  } catch {
    return { ok: false, technical: true };
  }
}

async function fetchOembedJson(
  endpoint: string
): Promise<
  | { kind: "ok"; data: Record<string, unknown>; status: number }
  | { kind: "reject"; status: number }
  | { kind: "technical"; status: number | null }
> {
  try {
    const res = await fetch(endpoint, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "application/json",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      return { kind: "reject", status: res.status };
    }
    if (res.status === 429 || res.status >= 500) {
      return { kind: "technical", status: res.status };
    }
    if (!res.ok) {
      return { kind: "technical", status: res.status };
    }
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("json")) {
      return { kind: "technical", status: res.status };
    }
    const data = (await res.json()) as Record<string, unknown>;
    return { kind: "ok", data, status: res.status };
  } catch {
    return { kind: "technical", status: null };
  }
}

/** Normalize for comparing new vs already-saved portfolio URLs. */
export function normalizeVideoUrlKey(url: string): string {
  return String(url || "")
    .trim()
    .split("?")[0]
    .split("#")[0]
    .replace(/\/+$/, "")
    .toLowerCase();
}

/** URLs in `next` that are not already in `existing` (by normalized key). */
export function findNewVideoUrls(next: string[], existing: string[]): string[] {
  const prev = new Set((existing || []).map(normalizeVideoUrlKey).filter(Boolean));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of next || []) {
    const u = String(raw || "").trim();
    if (!u) continue;
    const key = normalizeVideoUrlKey(u);
    if (!key || prev.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(u);
  }
  return out;
}

async function checkInstagram(url: string): Promise<VideoPlayableResult> {
  const media = extractInstagramMedia(url);
  if (!media) {
    return { playable: true, reason: "unchecked" };
  }

  const resolved = await resolveInstagramEmbedVideo(url);
  if (resolved.technicalFailure && !resolved.fetched) {
    return { playable: true, reason: "unchecked" };
  }

  if (resolved.videoUrl) {
    return { playable: true, reason: "instagram_video_url" };
  }

  // Video without public video_url → blocked outside Instagram (e.g. licensed music).
  if (resolved.isVideo) {
    return { playable: false, reason: "instagram_no_video_url" };
  }

  // Reels/TV are always video; missing video_url means not embeddable in Influo.
  if (media.kind === "reel" || media.kind === "tv") {
    return { playable: false, reason: "instagram_no_video_url" };
  }

  // /p/ photo (or non-video) — allow.
  if (media.kind === "p") {
    return { playable: true, reason: "instagram_photo" };
  }

  return { playable: true, reason: "unchecked" };
}

async function checkTikTok(url: string): Promise<VideoPlayableResult> {
  const resolved = await resolveTikTokUrl(url);
  if (!resolved.ok) {
    if (resolved.technical) return { playable: true, reason: "unchecked" };
    if (resolved.gone) return { playable: false, reason: "tiktok_gone" };
    return { playable: true, reason: "unchecked" };
  }

  const oembed = await fetchOembedJson(
    `https://www.tiktok.com/oembed?url=${encodeURIComponent(resolved.url)}`
  );
  if (oembed.kind === "technical") {
    return { playable: true, reason: "unchecked" };
  }
  if (oembed.kind === "reject") {
    return { playable: false, reason: `tiktok_oembed_${oembed.status}` };
  }
  const html = typeof oembed.data.html === "string" ? oembed.data.html : "";
  // TikTok oEmbed should include an embeddable html snippet.
  if (!html.trim()) {
    return { playable: false, reason: "tiktok_oembed_no_html" };
  }
  return { playable: true, reason: "tiktok_oembed" };
}

async function checkYouTube(url: string): Promise<VideoPlayableResult> {
  const id = youtubeVideoId(url);
  if (!id) return { playable: true, reason: "unchecked" };
  const watch = `https://www.youtube.com/watch?v=${id}`;
  const oembed = await fetchOembedJson(
    `https://www.youtube.com/oembed?url=${encodeURIComponent(watch)}&format=json`
  );
  if (oembed.kind === "technical") {
    return { playable: true, reason: "unchecked" };
  }
  if (oembed.kind === "reject") {
    return { playable: false, reason: `youtube_oembed_${oembed.status}` };
  }
  return { playable: true, reason: "youtube_oembed" };
}

/**
 * Returns whether `url` can be played inside Influo.
 * Unknown / non-IG-TT-YT links are left alone (playable).
 */
export async function checkVideoPlayable(url: string): Promise<VideoPlayableResult> {
  const raw = String(url || "").trim();
  if (!raw) return { playable: true, reason: "empty" };

  try {
    if (/instagram\.com\//i.test(raw) && extractInstagramMedia(raw)) {
      return await checkInstagram(raw);
    }
    if (/tiktok\.com|(vm|vt)\.tiktok\.com/i.test(raw)) {
      return await checkTikTok(raw);
    }
    if (/youtube\.com|youtu\.be/i.test(raw) && youtubeVideoId(raw)) {
      return await checkYouTube(raw);
    }
    return { playable: true, reason: "unsupported_host" };
  } catch {
    return { playable: true, reason: "unchecked" };
  }
}

/** Check only newly added URLs; first not-playable wins. */
export async function checkNewVideosPlayable(
  nextVideos: string[],
  existingVideos: string[]
): Promise<{ ok: true } | { ok: false; url: string; reason?: string }> {
  const news = findNewVideoUrls(nextVideos, existingVideos);
  for (const url of news) {
    const result = await checkVideoPlayable(url);
    if (!result.playable) {
      return { ok: false, url, reason: result.reason };
    }
  }
  return { ok: true };
}
