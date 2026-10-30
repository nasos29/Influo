import { NextRequest, NextResponse } from "next/server";
import { extractInstagramShortcode, isValidInstagramShortcode } from "@/lib/instagramShortcode";

/** Crawler UA: Instagram still embeds video_url (often double-escaped); browser UA often omits it. */
const CRAWLER_UA =
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function noStoreJson(body: Record<string, unknown>, status = 200) {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "private, max-age=0");
  return res;
}

/** Unescape JSON / double-escaped Instagram embed fragments. */
function decodeIgEscapedUrl(raw: string): string {
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

function extractVideoUrlFromEmbedHtml(html: string): string | null {
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

  // Last resort: first .mp4 URL near "video_url"
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

function extractPosterFromEmbedHtml(html: string): string | null {
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

/**
 * Resolve a playable Instagram reel/post MP4 URL from the public embed page.
 * No DB writes — short-lived CDN URLs only for in-page playback after click.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return noStoreJson({ error: "URL parameter is required", videoUrl: null }, 400);
  }

  const code = extractInstagramShortcode(url);
  if (!code || !isValidInstagramShortcode(code)) {
    return noStoreJson({ videoUrl: null, poster: null });
  }

  try {
    const embedUrl = `https://www.instagram.com/reel/${code}/embed/captioned/`;
    const fetchEmbed = (ua: string) =>
      fetch(embedUrl, {
        headers: {
          "User-Agent": ua,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          Referer: "https://www.instagram.com/",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
      });

    // Prefer crawler UA (still includes video_url); fall back to browser UA.
    for (const ua of [CRAWLER_UA, BROWSER_UA]) {
      const res = await fetchEmbed(ua);
      if (!res.ok) continue;
      const html = await res.text();
      const videoUrl = extractVideoUrlFromEmbedHtml(html);
      if (videoUrl) {
        const poster = extractPosterFromEmbedHtml(html);
        return noStoreJson({ videoUrl, poster });
      }
    }
    return noStoreJson({ videoUrl: null, poster: null });
  } catch (e) {
    console.error("[instagram-video]", e);
    return noStoreJson({ videoUrl: null, poster: null });
  }
}
