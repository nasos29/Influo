import { publicMediaUrl as buildPublicMediaUrl } from "@/lib/mediaStorage";

/**
 * Paths and URL helpers for self-hosted creator videos.
 * Bucket: creator-videos
 *   creators/<influencer_id>/portfolio/<platform>-<source_video_id>/
 *   creators/<influencer_id>/top-posts/<platform>-<source_video_id>/
 *   creators/<influencer_id>/collabs/<proposal-or-application-id>/
 * Filenames: video.mp4 (H.264, max 720p / ~2 Mbps) and poster.webp; optional video-hevc.mp4 or video-av1.mp4 only if at least 30% smaller than H.264.
 */

export const CREATOR_VIDEOS_BUCKET = "creator-videos";

export type CreatorMediaKind = "portfolio" | "top_post" | "collab";
export type CreatorMediaPlatform = "instagram" | "tiktok" | "youtube";
export type HostedMediaType = "video" | "photo" | "carousel";

export type HostedMedia = {
  sourceUrl: string;
  kind: CreatorMediaKind;
  folderPath: string;
  mediaType: HostedMediaType;
  playUrl: string;
  av1Url: string | null;
  hevcUrl: string | null;
  posterUrl: string | null;
  carouselUrls: string[] | null;
  durationMs: number | null;
  width: number | null;
  height: number | null;
};

const KIND_FOLDER: Record<CreatorMediaKind, string> = {
  portfolio: "portfolio",
  top_post: "top-posts",
  collab: "collabs",
};

/** Lowercase, strip query/hash, trailing slash, and www. for matching. */
export function normalizeSourceUrl(raw: string): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  try {
    const u = new URL(trimmed);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    let path = u.pathname || "/";
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    return `https://${host}${path}`;
  } catch {
    return trimmed.split("?")[0].split("#")[0].replace(/\/+$/, "").toLowerCase();
  }
}

export function detectMediaPlatform(url: string): CreatorMediaPlatform | null {
  const n = normalizeSourceUrl(url);
  if (/tiktok\.com|vm\.tiktok/.test(n)) return "tiktok";
  if (/instagram\.com|instagr\.am/.test(n)) return "instagram";
  if (/youtube\.com|youtu\.be/.test(n)) return "youtube";
  return null;
}

/** Platform + stable id used in folder names (lowercase, no spaces). */
export function sourceVideoId(url: string, platform: CreatorMediaPlatform | null): string | null {
  const n = normalizeSourceUrl(url);
  if (platform === "instagram") {
    const m = n.match(/\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i);
    return m ? m[1].toLowerCase() : null;
  }
  if (platform === "tiktok") {
    const m = n.match(/\/(?:video|photo)\/(\d+)/);
    if (m) return m[1];
    const short = n.match(/\/([A-Za-z0-9]+)\/?$/);
    return short ? short[1].toLowerCase() : null;
  }
  if (platform === "youtube") {
    const watch = n.match(/[?&]v=([A-Za-z0-9_-]{6,})/) || n.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/) || n.match(/\/shorts\/([A-Za-z0-9_-]{6,})/);
    // normalizeSourceUrl drops query, so watch?v= won't survive — handle raw too
    const raw = String(url || "");
    const fromRaw =
      raw.match(/[?&]v=([A-Za-z0-9_-]{6,})/) ||
      raw.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/) ||
      raw.match(/\/shorts\/([A-Za-z0-9_-]{6,})/);
    const id = (watch || fromRaw)?.[1];
    return id ? id : null;
  }
  return null;
}

function safeSegment(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function influencerStoragePrefix(influencerId: string): string {
  return `creators/${safeSegment(influencerId)}/`;
}

export function mediaFolderPath(opts: {
  influencerId: string;
  kind: CreatorMediaKind;
  platform?: CreatorMediaPlatform | null;
  sourceVideoId?: string | null;
  collabId?: string | null;
}): string {
  const root = influencerStoragePrefix(opts.influencerId);
  const folder = KIND_FOLDER[opts.kind];
  if (opts.kind === "collab") {
    const id = safeSegment(opts.collabId || "unknown");
    return `${root}${folder}/${id}/`;
  }
  const platform = safeSegment(opts.platform || "video");
  const id = safeSegment(opts.sourceVideoId || "unknown");
  return `${root}${folder}/${platform}-${id}/`;
}

/** Public URL for a stored object. Backend/base come from mediaStorage env. */
export function publicMediaUrl(path: string | null | undefined): string | null {
  return buildPublicMediaUrl(path);
}

function readMediaType(raw: unknown, playPath: string | null | undefined): HostedMediaType {
  if (raw === "photo" || raw === "carousel" || raw === "video") return raw;
  const p = String(playPath || "").toLowerCase();
  if (p.endsWith("photo.webp")) return "photo";
  if (p.includes("/carousel-")) return "carousel";
  return "video";
}

function carouselUrlsFromMetadata(meta: unknown): string[] | null {
  if (!meta || typeof meta !== "object") return null;
  const urls = (meta as { carousel_urls?: unknown }).carousel_urls;
  if (!Array.isArray(urls)) return null;
  const out = urls.filter((u): u is string => typeof u === "string" && u.length > 0);
  return out.length ? out : null;
}

export function mediaFromRow(row: {
  source_url: string;
  kind: string;
  folder_path: string;
  media_type?: string | null;
  metadata?: unknown;
  play_path?: string | null;
  av1_path?: string | null;
  hevc_path?: string | null;
  poster_path?: string | null;
  duration_ms?: number | null;
  width?: number | null;
  height?: number | null;
}): HostedMedia | null {
  const playUrl = publicMediaUrl(row.play_path);
  if (!playUrl) return null;
  const mediaType = readMediaType(row.media_type, row.play_path);
  const carouselUrls = carouselUrlsFromMetadata(row.metadata);
  return {
    sourceUrl: row.source_url,
    kind: row.kind as CreatorMediaKind,
    folderPath: row.folder_path,
    mediaType,
    playUrl,
    av1Url: mediaType === "video" ? publicMediaUrl(row.av1_path) : null,
    hevcUrl: mediaType === "video" ? publicMediaUrl(row.hevc_path) : null,
    posterUrl: publicMediaUrl(row.poster_path),
    carouselUrls,
    durationMs: row.duration_ms ?? null,
    width: row.width ?? null,
    height: row.height ?? null,
  };
}

/** Prefer a ready row; if the same URL is stored under portfolio and top_post, either works (same files). */
export function hostedMediaByNormalizedUrl(
  rows: HostedMedia[]
): Map<string, HostedMedia> {
  const map = new Map<string, HostedMedia>();
  const rank = (kind: CreatorMediaKind) => (kind === "portfolio" ? 0 : 1);
  const sorted = [...rows].sort((a, b) => rank(a.kind) - rank(b.kind));
  for (const row of sorted) {
    const key = normalizeSourceUrl(row.sourceUrl);
    if (key && !map.has(key)) map.set(key, row);
  }
  return map;
}

export function lookupHostedMedia(
  map: Map<string, HostedMedia>,
  sourceUrl: string
): HostedMedia | null {
  return map.get(normalizeSourceUrl(sourceUrl)) || null;
}
