import type { HostedMedia, HostedMediaType } from "@/lib/creatorMedia";
import { isSelfHostedPortfolioUrl } from "@/lib/portfolioHosted";

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