/**
 * Shared Instagram embed/captioned parsing for in-page playback + playability checks.
 * Prefer crawler UA (still embeds video_url); fall back to browser UA.
 */

import {
  extractInstagramMedia,
  extractInstagramShortcode,
  isValidInstagramShortcode,
} from "@/lib/instagramShortcode";
import {
  parseInstagramEmbedKindFromHtml,
  type InstagramEmbedKind,
} from "@/lib/instagramMediaType";
import { extractOgImageFromHtml } from "@/lib/videoThumbnailExtract";

const CRAWLER_UA =
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const EMBED_TIMEOUT_MS = 8000;

/** Unescape JSON / double-escaped Instagram embed fragments. */
export function decodeIgEscapedUrl(raw: string): string {
  let s = raw;
  for (let i = 0; i < 5; i++) {
    const next = s
      .replace(/\\u0026/gi, "&")
      .replace(/\\u003d/gi, "=")
      .replace(/\\u0025/gi, "%")
      .replace(/\\\//g, "/")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
    if (next === s) break;
    s = next;
  }
  return s.trim();
}

export function extractVideoUrlFromEmbedHtml(html: string): string | null {
  const patterns = [
    /"video_url"\s*:\s*"((?:\\.|[^"\\])*)"/,
    /\\"video_url\\"\s*:\s*\\"((?:\\.|[^"\\])*)\\"/,
    /"browser_native_hd_url"\s*:\s*"((?:\\.|[^"\\])*)"/,
    /"browser_native_sd_url"\s*:\s*"((?:\\.|[^"\\])*)"/,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (!m?.[1]) continue;
    const url = decodeIgEscapedUrl(m[1]);
    if (url.startsWith("http")) return url;
  }

  const i = html.indexOf("video_url");
  if (i >= 0) {
    const slice = html.slice(i, i + 3000);
    const m = slice.match(/https[:\\\/=a-zA-Z0-9._\-?&%]+?\.mp4[:\\\/=a-zA-Z0-9._\-?&%]*/);
    if (m) {
      const url = decodeIgEscapedUrl(m[0]);
      if (url.startsWith("http")) return url;
    }
  }
  return null;
}

function decodeHtmlAttrUrl(raw: string): string {
  return decodeIgEscapedUrl(
    raw
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#x2F;/gi, "/")
      .replace(/&#39;/gi, "'")
  );
}

export function extractPosterFromEmbedHtml(html: string): string | null {
  // Crawler /embed markup first (clean attr; avoids over-long escaped JSON captures).
  const emb = html.match(
    /class="EmbeddedMediaImage"[^>]*\ssrc="([^"]+)"|src="([^"]+)"[^>]*\sclass="EmbeddedMediaImage"/i
  );
  const embSrc = emb?.[1] || emb?.[2];
  if (embSrc) {
    const url = decodeHtmlAttrUrl(embSrc);
    if (url.startsWith("http")) return url;
  }

  const keys = ["display_url", "thumbnail_src", "thumbnail_url"];
  for (const key of keys) {
    // Plain JSON string value starting with https (stop at raw ").
    const plain = html.match(
      new RegExp(`"${key}"\\s*:\\s*"(https:[^"]+)"`)
    );
    if (plain?.[1]) {
      const url = decodeIgEscapedUrl(plain[1]);
      if (url.startsWith("http") && !url.includes("display_resources")) return url;
    }
    // Double-escaped crawler JSON: \"display_url\":\"https:\/\/…jpg…\"
    // Do not use (?:\\.|[^"\\])* — \\. consumes \" and over-reads the blob.
    const escaped = html.match(
      new RegExp(
        `\\\\"${key}\\\\"\\s*:\\s*\\\\"(https:(?:\\\\[\\\\/u]|[^"\\\\])*)\\\\"`
      )
    );
    if (escaped?.[1]) {
      const url = decodeIgEscapedUrl(escaped[1]);
      if (url.startsWith("http") && url.length < 4000) return url;
    }
  }

  const og = extractOgImageFromHtml(html);
  if (og) return og;

  return null;
}

const MAX_SIDECAR_IMAGES = 10;

/**
 * GraphSidecar child posters from edge_sidecar_to_children (display_url; video → poster).
 * Max 10 unique http(s) URLs.
 */
export function extractSidecarImagesFromEmbedHtml(html: string): string[] {
  if (!html) return [];
  const marker = "edge_sidecar_to_children";
  // Prefer content after the marker so parent GraphSidecar display_url is excluded.
  const start = html.indexOf(marker);
  if (start < 0) return [];
  const slice = html.slice(start, start + 80_000);
  const urls: string[] = [];
  const seen = new Set<string>();

  const push = (raw: string) => {
    const url = decodeIgEscapedUrl(raw);
    if (!url.startsWith("http") || url.length >= 4000) return;
    if (url.includes("display_resources")) return;
    if (seen.has(url)) return;
    seen.add(url);
    urls.push(url);
  };

  const plainRe = /"display_url"\s*:\s*"(https:[^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = plainRe.exec(slice)) !== null && urls.length < MAX_SIDECAR_IMAGES) {
    push(m[1]);
  }

  if (urls.length === 0) {
    const escRe =
      /\\"display_url\\"\s*:\s*\\"(https:(?:\\[\\/u]|[^"\\])*)\\"/g;
    while ((m = escRe.exec(slice)) !== null && urls.length < MAX_SIDECAR_IMAGES) {
      push(m[1]);
    }
  }

  return urls.slice(0, MAX_SIDECAR_IMAGES);
}

/** oEmbed thumbnail when embed HTML has no poster (login/error walls). */
export async function fetchInstagramOEmbedPoster(
  postUrl: string
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(postUrl)}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": BROWSER_UA,
        },
        signal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { thumbnail_url?: unknown };
    const thumb =
      typeof data.thumbnail_url === "string" ? data.thumbnail_url.trim() : "";
    return thumb.startsWith("http") ? thumb : null;
  } catch {
    return null;
  }
}

/** True when embed HTML indicates a video (even if CDN URL is withheld). */
export function embedHtmlIndicatesVideo(html: string): boolean {
  if (!html) return false;
  if (/"is_video"\s*:\s*true/.test(html) || /\\"is_video\\"\s*:\s*true/.test(html)) {
    return true;
  }
  return parseInstagramEmbedKindFromHtml(html) === "video";
}

export type InstagramEmbedResolve = {
  videoUrl: string | null;
  poster: string | null;
  mediaType: InstagramEmbedKind | null;
  /** Sidecar child posters (display_url); empty when not a multi-image carousel. */
  images: string[];
  /** True when the media is a video (GraphVideo / is_video). */
  isVideo: boolean;
  /** True when we successfully fetched embed HTML from at least one UA. */
  fetched: boolean;
  /** Technical failure (timeout / 5xx / blocked) — caller may treat as unchecked. */
  technicalFailure?: boolean;
};

function emptyResolve(
  partial: Partial<InstagramEmbedResolve> = {}
): InstagramEmbedResolve {
  return {
    videoUrl: null,
    poster: null,
    mediaType: null,
    images: [],
    isVideo: false,
    fetched: false,
    ...partial,
  };
}

function imagesForHtml(html: string, kind: InstagramEmbedKind | null): string[] {
  if (kind !== "carousel" || !html) return [];
  return extractSidecarImagesFromEmbedHtml(html);
}

function embedCaptionedUrl(urlOrCode: string, code: string): string {
  const media = extractInstagramMedia(urlOrCode);
  const kind = media?.kind === "p" ? "p" : media?.kind === "tv" ? "tv" : "reel";
  // /p/ posts resolve GraphImage more reliably via /p/…/embed
  if (kind === "p") return `https://www.instagram.com/p/${code}/embed/captioned/`;
  if (kind === "tv") return `https://www.instagram.com/tv/${code}/embed/captioned/`;
  return `https://www.instagram.com/reel/${code}/embed/captioned/`;
}

async function fetchEmbedHtml(
  urlOrCode: string,
  code: string,
  ua: string
): Promise<Response> {
  const embedUrl = embedCaptionedUrl(urlOrCode, code);
  return fetch(embedUrl, {
    headers: {
      "User-Agent": ua,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://www.instagram.com/",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
  });
}

function kindFromHtml(html: string): InstagramEmbedKind | null {
  return parseInstagramEmbedKindFromHtml(html) ?? null;
}

/**
 * Resolve playable MP4 (+ poster + mediaType) from Instagram embed/captioned.
 */
export async function resolveInstagramEmbedVideo(
  urlOrCode: string
): Promise<InstagramEmbedResolve> {
  const code =
    extractInstagramShortcode(urlOrCode) ||
    (isValidInstagramShortcode(urlOrCode) ? urlOrCode : null);
  if (!code || !isValidInstagramShortcode(code)) {
    return emptyResolve();
  }

  let sawTechnical = false;
  let fetched = false;
  let bestHtml = "";
  let bestKind: InstagramEmbedKind | null = null;
  let bestPoster: string | null = null;
  let bestImages: string[] = [];

  try {
    for (const ua of [CRAWLER_UA, BROWSER_UA]) {
      let res: Response;
      try {
        res = await fetchEmbedHtml(urlOrCode, code, ua);
      } catch {
        sawTechnical = true;
        continue;
      }
      if (res.status >= 500 || res.status === 429) {
        sawTechnical = true;
        continue;
      }
      if (!res.ok) continue;

      const html = await res.text();
      // Skip login/error shells that lack media markers (browser often hits these).
      if (/PolarisErrorRoot|httpErrorPage/i.test(html) && !/data-media-type=/i.test(html)) {
        fetched = true;
        continue;
      }

      fetched = true;
      const kind = kindFromHtml(html);
      const poster = extractPosterFromEmbedHtml(html);
      const images = imagesForHtml(html, kind || bestKind);
      if (kind && !bestKind) bestKind = kind;
      if (poster && !bestPoster) bestPoster = poster;
      if (images.length > bestImages.length) bestImages = images;
      if (kind || poster || images.length) bestHtml = html;

      const videoUrl = extractVideoUrlFromEmbedHtml(html);
      if (videoUrl) {
        return emptyResolve({
          videoUrl,
          poster: poster || bestPoster,
          mediaType: kind || bestKind || "video",
          images: [],
          isVideo: true,
          fetched: true,
        });
      }

      // Photos / carousels: no MP4 — stop once we have type (+ optional poster).
      const resolvedKind = kind || bestKind;
      if (resolvedKind === "image" || resolvedKind === "carousel") {
        const imgs =
          resolvedKind === "carousel"
            ? images.length
              ? images
              : bestImages
            : [];
        const cover = poster || bestPoster || imgs[0] || null;
        return emptyResolve({
          videoUrl: null,
          poster: cover,
          mediaType: resolvedKind,
          images: imgs,
          isVideo: false,
          fetched: true,
        });
      }
      // Video without URL yet: try next UA for MP4; meta already kept in best*.
    }

    if (fetched) {
      let mediaType =
        bestKind || (bestHtml ? kindFromHtml(bestHtml) : null);
      let poster =
        bestPoster ||
        (bestHtml ? extractPosterFromEmbedHtml(bestHtml) : null);
      let images =
        bestImages.length > 0
          ? bestImages
          : imagesForHtml(bestHtml, mediaType);

      // Old posts / login shells: no GraphQL — still recover image from HTML/og.
      if (!mediaType && poster) {
        mediaType = /EmbedSidecar|data-media-type="GraphSidecar"/i.test(bestHtml)
          ? "carousel"
          : "image";
      }

      if (!poster) {
        const canonical = `https://www.instagram.com/p/${code}/`;
        poster = await fetchInstagramOEmbedPoster(canonical);
        if (!mediaType && poster) mediaType = "image";
      }

      if (mediaType === "carousel" && images.length === 0 && poster) {
        images = [poster];
      }
      if (!poster && images[0]) poster = images[0];

      const isVideo =
        mediaType === "video" ||
        (bestHtml ? embedHtmlIndicatesVideo(bestHtml) : false);
      return emptyResolve({
        videoUrl: null,
        poster,
        mediaType: mediaType || (isVideo ? "video" : null),
        images: mediaType === "carousel" ? images : [],
        isVideo,
        fetched: true,
      });
    }

    // Last resort: oEmbed poster → treat as static image (never leave UI blank).
    const poster = await fetchInstagramOEmbedPoster(
      `https://www.instagram.com/p/${code}/`
    );
    return emptyResolve({
      videoUrl: null,
      poster,
      mediaType: poster ? "image" : null,
      isVideo: false,
      fetched: false,
      technicalFailure: sawTechnical || true,
    });
  } catch {
    return emptyResolve({ technicalFailure: true });
  }
}
