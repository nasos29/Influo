/**
 * Shared Instagram embed/captioned parsing for in-page playback + playability checks.
 * Prefer crawler UA (still embeds video_url); fall back to browser UA.
 */

import { extractInstagramShortcode, isValidInstagramShortcode } from "@/lib/instagramShortcode";
import { parseInstagramMediaTypeFromEmbedHtml } from "@/lib/instagramMediaType";

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

export function extractPosterFromEmbedHtml(html: string): string | null {
  const keys = ["display_url", "thumbnail_src", "thumbnail_url"];
  for (const key of keys) {
    const patterns = [
      new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`),
      new RegExp(`\\\\"${key}\\\\"\\s*:\\s*\\\\"((?:\\\\.|[^"\\\\])*)\\\\"`),
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (!m?.[1]) continue;
      const url = decodeIgEscapedUrl(m[1]);
      if (url.startsWith("http")) return url;
    }
  }
  return null;
}

/** True when embed HTML indicates a video (even if CDN URL is withheld). */
export function embedHtmlIndicatesVideo(html: string): boolean {
  if (!html) return false;
  if (/"is_video"\s*:\s*true/.test(html) || /\\"is_video\\"\s*:\s*true/.test(html)) {
    return true;
  }
  const mediaType = parseInstagramMediaTypeFromEmbedHtml(html);
  return mediaType === "video";
}

export type InstagramEmbedResolve = {
  videoUrl: string | null;
  poster: string | null;
  /** True when the media is a video (GraphVideo / is_video). */
  isVideo: boolean;
  /** True when we successfully fetched embed HTML from at least one UA. */
  fetched: boolean;
  /** Technical failure (timeout / 5xx / blocked) — caller may treat as unchecked. */
  technicalFailure?: boolean;
};

async function fetchEmbedHtml(code: string, ua: string): Promise<Response> {
  const embedUrl = `https://www.instagram.com/reel/${code}/embed/captioned/`;
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

/**
 * Resolve playable MP4 (+ poster) from Instagram embed/captioned.
 * Also reports whether the post is a video without a public video_url.
 */
export async function resolveInstagramEmbedVideo(
  urlOrCode: string
): Promise<InstagramEmbedResolve> {
  const code =
    extractInstagramShortcode(urlOrCode) ||
    (isValidInstagramShortcode(urlOrCode) ? urlOrCode : null);
  if (!code || !isValidInstagramShortcode(code)) {
    return { videoUrl: null, poster: null, isVideo: false, fetched: false };
  }

  let sawTechnical = false;
  let fetched = false;
  let lastHtml = "";
  let anyIsVideo = false;

  try {
    for (const ua of [CRAWLER_UA, BROWSER_UA]) {
      let res: Response;
      try {
        res = await fetchEmbedHtml(code, ua);
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
      fetched = true;
      lastHtml = html;
      if (embedHtmlIndicatesVideo(html)) anyIsVideo = true;
      const videoUrl = extractVideoUrlFromEmbedHtml(html);
      if (videoUrl) {
        return {
          videoUrl,
          poster: extractPosterFromEmbedHtml(html),
          isVideo: true,
          fetched: true,
        };
      }
    }

    if (fetched) {
      return {
        videoUrl: null,
        poster: extractPosterFromEmbedHtml(lastHtml),
        isVideo: anyIsVideo || embedHtmlIndicatesVideo(lastHtml),
        fetched: true,
      };
    }

    return {
      videoUrl: null,
      poster: null,
      isVideo: false,
      fetched: false,
      technicalFailure: sawTechnical || true,
    };
  } catch {
    return {
      videoUrl: null,
      poster: null,
      isVideo: false,
      fetched: false,
      technicalFailure: true,
    };
  }
}
