import type { CreatorMediaKind, HostedMedia, HostedMediaType } from "@/lib/creatorMedia";
import { lookupHostedMedia } from "@/lib/creatorMedia";
import { isPortfolioStillImageUrl, isSelfHostedPortfolioUrl } from "@/lib/portfolioHosted";

export type HostedDisplayMode = "video" | "photo" | "carousel";

export function hostedDisplayMode(media: Pick<HostedMedia, "mediaType" | "carouselUrls">): HostedDisplayMode {
  if (media.mediaType === "carousel" && (media.carouselUrls?.length ?? 0) > 1) return "carousel";
  if (media.mediaType === "photo" || media.mediaType === "carousel") return "photo";
  return "video";
}

export function isHostedPhotoMedia(media: Pick<HostedMedia, "mediaType">): boolean {
  return media.mediaType === "photo" || media.mediaType === "carousel";
}

/** Poster.webp beside a hosted portfolio video.mp4 (directory / dashboard thumbnails). */
export function hostedPortfolioPosterUrl(portfolioUrl: string | null | undefined): string | null {
  const u = String(portfolioUrl || "").trim();
  if (!u || !isSelfHostedPortfolioUrl(u)) return null;
  if (/\/video\.mp4(\?|#|$)/i.test(u)) {
    return u.replace(/\/video\.mp4(\?[^#]*)?(#.*)?$/i, "/poster.webp");
  }
  if (/\/photo\.webp(\?|#|$)/i.test(u)) return u.split("?")[0].split("#")[0];
  if (/\/carousel-\d+\.webp(\?|#|$)/i.test(u)) return u.split("?")[0].split("#")[0];
  return null;
}

export function carouselImageList(media: HostedMedia): string[] {
  if (media.carouselUrls?.length) return media.carouselUrls;
  if (media.playUrl) return [media.playUrl];
  return [];
}

export function assertHostedMediaType(value: unknown): HostedMediaType {
  if (value === "video" || value === "photo" || value === "carousel") return value;
  return "video";
}

function stripUrlQueryHash(url: string): string {
  return url.split("?")[0].split("#")[0];
}

/** Infer media type from a self-hosted portfolio / top-post storage URL (no DB row). */
export function inferMediaTypeFromStorageUrl(url: string): HostedMediaType | null {
  const u = String(url || "").trim();
  if (!u || !isSelfHostedPortfolioUrl(u)) return null;
  if (/\/carousel-\d+\.webp(\?|#|$)/i.test(u)) return "carousel";
  if (/\/photo\.webp(\?|#|$)/i.test(u)) return "photo";
  if (/\/video\.mp4(\?|#|$)/i.test(u)) return "video";
  return null;
}

function folderPathFromStorageUrl(url: string): string {
  const bare = stripUrlQueryHash(url);
  const match = bare.match(/\/creators\/[0-9a-f-]{36}\/(?:portfolio|top-posts|collabs)\/[^/]+\//i);
  if (match?.[0]) {
    return match[0].replace(/^\//, "");
  }
  const idx = bare.search(/creators\/[0-9a-f-]{36}\//i);
  if (idx >= 0) {
    const tail = bare.slice(idx);
    const slash = tail.lastIndexOf("/");
    return slash >= 0 ? `${tail.slice(0, slash + 1)}` : tail;
  }
  return "";
}

/** Build a playable HostedMedia from a direct storage URL when creator_media is missing. */
export function hostedMediaFromStorageUrl(
  url: string,
  kind: CreatorMediaKind = "portfolio"
): HostedMedia | null {
  const mediaType = inferMediaTypeFromStorageUrl(url);
  if (!mediaType) return null;
  const playUrl = stripUrlQueryHash(url);
  const posterUrl = hostedPortfolioPosterUrl(url) ?? (mediaType !== "video" ? playUrl : null);
  return {
    sourceUrl: url,
    kind,
    folderPath: folderPathFromStorageUrl(url),
    mediaType,
    playUrl,
    av1Url: null,
    hevcUrl: null,
    posterUrl,
    carouselUrls: mediaType === "carousel" ? [playUrl] : null,
    durationMs: null,
    width: null,
    height: null,
  };
}

/** Ready creator_media row, else infer from our storage URL (uploads / hosted copies). */
export function resolvePortfolioHostedMedia(
  map: Map<string, HostedMedia>,
  sourceUrl: string
): HostedMedia | null {
  const fromDb = lookupHostedMedia(map, sourceUrl);
  if (fromDb) return fromDb;
  if (isSelfHostedPortfolioUrl(sourceUrl) || isPortfolioStillImageUrl(sourceUrl)) {
    return hostedMediaFromStorageUrl(sourceUrl);
  }
  return null;
}