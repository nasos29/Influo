import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveYouTubeVideoId } from "@/lib/videoThumbnailYoutube";
import {
  extractOgImageFromHtml,
  extractTikTokCoverFromHtml,
  isGenericLogoThumbnail,
} from "@/lib/videoThumbnailExtract";
import { isValidInstagramShortcode } from "@/lib/instagramShortcode";
import {
  parseInstagramMediaTypeFromEmbedHtml,
  type InstagramMediaType,
} from "@/lib/instagramMediaType";
import { getSignedUrlExpiryMs } from "@/lib/signedCdnExpiry";
import {
  isVideoThumbsStorageUrl,
  persistVideoThumbToStorage,
} from "@/lib/persistVideoThumb";
import { getCachedImageUrl } from "@/lib/imageProxy";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const CACHE_DAYS_DEFAULT = 365;
const STORAGE_CACHE_DAYS = 365;
const SIGNED_SKEW_MS = 60 * 60 * 1000; // 1 hour
const REFRESH_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const FACEBOOK_UA = "facebookexternalhit/1.1";

export type MediaType = "video" | "image";

function stripUrlNoise(url: string): string {
  return url.split("?")[0].split("#")[0].trim();
}

function cacheTtlMs(platform: string): number {
  if (platform === "tiktok" || platform === "instagram") {
    return 24 * 60 * 60 * 1000;
  }
  return CACHE_DAYS_DEFAULT * 24 * 60 * 60 * 1000;
}

/** Encode mediaType into thumbnail_url without a DB schema change. */
function encodeCachedPayload(thumbnailUrl: string, mediaType?: MediaType): string {
  if (!mediaType) return thumbnailUrl;
  return JSON.stringify({ url: thumbnailUrl, mediaType });
}

function decodeCachedPayload(raw: string): { thumbnail: string; mediaType?: MediaType } {
  const trimmed = String(raw || "").trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { url?: unknown; mediaType?: unknown };
      if (typeof parsed?.url === "string" && parsed.url) {
        const mt =
          parsed.mediaType === "video" || parsed.mediaType === "image"
            ? (parsed.mediaType as MediaType)
            : undefined;
        return { thumbnail: parsed.url, mediaType: mt };
      }
    } catch {
      /* plain URL */
    }
  }
  return { thumbnail: trimmed };
}

function computeExpiresAt(thumbnailUrl: string, platform: string): Date {
  const now = Date.now();
  if (isVideoThumbsStorageUrl(thumbnailUrl)) {
    return new Date(now + STORAGE_CACHE_DAYS * 24 * 60 * 60 * 1000);
  }
  const platformExpiry = now + cacheTtlMs(platform);
  const signedMs = getSignedUrlExpiryMs(thumbnailUrl);
  if (signedMs != null) {
    const signedCap = signedMs - SIGNED_SKEW_MS;
    return new Date(Math.min(platformExpiry, signedCap));
  }
  return new Date(platformExpiry);
}

/** Save thumbnail (+ optional mediaType) to DB cache. Upsert overwrites logo / stale entries. */
async function saveThumbnailCache(
  originalUrl: string,
  thumbnailUrl: string | null,
  platform: string,
  mediaType?: MediaType
) {
  if (!thumbnailUrl || isGenericLogoThumbnail(thumbnailUrl)) return;
  try {
    const expiresAt = computeExpiresAt(thumbnailUrl, platform);
    await supabaseAdmin.from("video_thumbnail_cache").upsert(
      {
        original_url: originalUrl,
        thumbnail_url: encodeCachedPayload(thumbnailUrl, mediaType),
        platform,
        cached_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      },
      { onConflict: "original_url" }
    );
  } catch {
    // Table might not exist
  }
}

function forClient(url: string | null): string | null {
  if (!url) return null;
  return (getCachedImageUrl(url) as string | null | undefined) ?? url;
}

function jsonThumb(
  thumbnail: string | null,
  platform: string,
  extra?: Record<string, unknown>
) {
  const res = NextResponse.json({ thumbnail: forClient(thumbnail), platform, ...extra });
  const maxAge =
    platform === "tiktok" || platform === "instagram"
      ? isVideoThumbsStorageUrl(thumbnail || "")
        ? 31536000
        : 86400
      : 31536000;
  res.headers.set("Cache-Control", `public, max-age=${maxAge}, s-maxage=${maxAge}`);
  return res;
}

/**
 * Normalize TikTok URL that contains /video|photo/{id}.
 * Preserves /photo/ (do not rewrite to /video/).
 */
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

function tikTokMediaTypeFromUrl(url: string): MediaType | undefined {
  if (/\/photo\/\d+/i.test(url)) return "image";
  if (/\/video\/\d+/i.test(url)) return "video";
  return undefined;
}

/**
 * Resolve vm/vt.tiktok.com and tiktok.com/t/{code} → full /@user/video|photo/ID
 * (manual redirects, 5s timeout).
 */
async function resolveTikTokUrl(url: string): Promise<string> {
  const clean = stripUrlNoise(url);
  const already = tikTokCanonicalFromAny(clean);
  if (already) return already;
  if (!/(vm|vt)\.tiktok\.com\/[\w-]+|tiktok\.com\/t\/[\w-]+/i.test(clean)) return clean;
  try {
    let current = clean;
    for (let hop = 0; hop < 5; hop++) {
      const res = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(5000),
        headers: { "User-Agent": BROWSER_UA },
      });
      try {
        await res.body?.cancel?.();
      } catch {
        /* ignore */
      }
      const loc = res.headers.get("location");
      if (!(res.status >= 300 && res.status < 400) || !loc) break;
      current = new URL(loc, current).href;
      const resolved = tikTokCanonicalFromAny(current);
      if (resolved) return resolved;
    }
    return clean;
  } catch {
    return clean;
  }
}

async function tikTokThumbnailViaOEmbed(resolvedUrl: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(resolvedUrl)}`,
      { headers: { "User-Agent": BROWSER_UA }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { thumbnail_url?: string };
    const thumb = data.thumbnail_url ? String(data.thumbnail_url) : null;
    if (!thumb || isGenericLogoThumbnail(thumb)) return null;
    return thumb;
  } catch {
    return null;
  }
}

async function tikTokThumbnailFromPage(resolvedUrl: string): Promise<string | null> {
  try {
    const pageResponse = await fetch(resolvedUrl, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });
    if (!pageResponse.ok) return null;
    const html = await pageResponse.text();
    return extractTikTokCoverFromHtml(html) || extractOgImageFromHtml(html);
  } catch {
    return null;
  }
}

async function resolveTikTokThumbnail(url: string): Promise<{
  thumbnail: string | null;
  resolvedUrl: string;
  mediaType?: MediaType;
}> {
  const resolved = await resolveTikTokUrl(url);
  const mediaType = tikTokMediaTypeFromUrl(resolved) ?? tikTokMediaTypeFromUrl(url);
  const oembed = await tikTokThumbnailViaOEmbed(resolved);
  if (oembed) return { thumbnail: oembed, resolvedUrl: resolved, mediaType };
  const page = await tikTokThumbnailFromPage(resolved);
  return { thumbnail: page, resolvedUrl: resolved, mediaType };
}

async function resolveInstagramThumbnail(url: string): Promise<string | null> {
  const cleanUrl = stripUrlNoise(url);
  try {
    const pageResponse = await fetch(cleanUrl, {
      headers: {
        "User-Agent": FACEBOOK_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });
    if (!pageResponse.ok) return null;
    const html = await pageResponse.text();
    return extractOgImageFromHtml(html);
  } catch {
    return null;
  }
}

/**
 * Fetch Instagram embed captioned page and read GraphQL __typename.
 * Uses a normal browser UA (not the Facebook crawler).
 */
async function detectInstagramMediaType(
  shortcode: string
): Promise<InstagramMediaType | undefined> {
  const code = String(shortcode || "").trim();
  if (!isValidInstagramShortcode(code)) return undefined;
  try {
    const embedUrl = `https://www.instagram.com/p/${code}/embed/captioned/`;
    const res = await fetch(embedUrl, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return undefined;
    const html = await res.text();
    return parseInstagramMediaTypeFromEmbedHtml(html);
  } catch {
    return undefined;
  }
}

type CacheHit = {
  thumbnail: string;
  platform: string;
  mediaType?: MediaType;
  cachedAt: number | null;
};

/**
 * Cache hit only when DB row is still valid AND the stored URL is not a
 * near-expired signed CDN link. Storage URLs are durable.
 */
async function readCache(
  cleanUrl: string,
  opts?: { forceRefresh?: boolean }
): Promise<CacheHit | null> {
  try {
    const { data: cached, error: cacheError } = await supabaseAdmin
      .from("video_thumbnail_cache")
      .select("thumbnail_url, platform, expires_at, cached_at")
      .eq("original_url", cleanUrl)
      .single();
    if (cacheError || !cached?.thumbnail_url) return null;

    const decoded = decodeCachedPayload(String(cached.thumbnail_url));
    if (isGenericLogoThumbnail(decoded.thumbnail)) return null;

    const cachedAtMs = cached.cached_at ? new Date(cached.cached_at).getTime() : NaN;
    const hit: CacheHit = {
      thumbnail: decoded.thumbnail,
      platform: (cached.platform as string) || "unknown",
      mediaType: decoded.mediaType,
      cachedAt: Number.isFinite(cachedAtMs) ? cachedAtMs : null,
    };

    // ?refresh=1: bypass unless we refreshed this URL in the last 10 minutes
    if (opts?.forceRefresh) {
      if (hit.cachedAt != null && Date.now() - hit.cachedAt < REFRESH_COOLDOWN_MS) {
        return hit;
      }
      return null;
    }

    const expiresAt = new Date(cached.expires_at);
    if (!(expiresAt > new Date())) {
      await supabaseAdmin.from("video_thumbnail_cache").delete().eq("original_url", cleanUrl);
      return null;
    }

    // Durable Storage covers — trust DB expires_at
    if (isVideoThumbsStorageUrl(decoded.thumbnail)) {
      return hit;
    }

    // Signed CDN: treat as miss if expired or within 1h of expiry
    const signedExp = getSignedUrlExpiryMs(decoded.thumbnail);
    if (signedExp != null && signedExp - Date.now() < SIGNED_SKEW_MS) {
      return null;
    }

    return hit;
  } catch {
    return null;
  }
}

async function persistAndCache(
  cleanUrl: string,
  platform: "tiktok" | "instagram",
  remoteThumb: string,
  mediaType?: MediaType
): Promise<string> {
  const stored = await persistVideoThumbToStorage(
    supabaseAdmin,
    platform,
    cleanUrl,
    remoteThumb
  );
  const finalUrl = stored || remoteThumb;
  await saveThumbnailCache(cleanUrl, finalUrl, platform, mediaType);
  return finalUrl;
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "URL parameter is required" }, { status: 400 });
  }

  const cleanUrl = stripUrlNoise(url);
  const forceRefresh = req.nextUrl.searchParams.get("refresh") === "1";

  try {
    const cached = await readCache(cleanUrl, { forceRefresh });
    if (cached) {
      return jsonThumb(cached.thumbnail, cached.platform, {
        ...(cached.mediaType ? { mediaType: cached.mediaType } : {}),
      });
    }

    const ytId = resolveYouTubeVideoId(url);
    if (ytId) {
      return jsonThumb(`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`, "youtube", {
        mediaType: "video",
      });
    }

    const instagramMatch = url.match(
      /instagram\.com\/(?:(?:[A-Za-z0-9._]+)\/)?(p|reel|tv)\/([A-Za-z0-9_-]+)/i
    );
    if (instagramMatch) {
      const kind = (instagramMatch[1] || "").toLowerCase();
      const code = instagramMatch[2] || "";
      let mediaType: MediaType | undefined;
      if (kind === "reel" || kind === "tv") {
        mediaType = "video";
      } else if (kind === "p" && code) {
        mediaType = await detectInstagramMediaType(code);
      }

      const thumb = await resolveInstagramThumbnail(url);
      if (thumb) {
        const finalUrl = await persistAndCache(cleanUrl, "instagram", thumb, mediaType);
        return jsonThumb(finalUrl, "instagram", {
          ...(mediaType ? { mediaType } : {}),
        });
      }
      return jsonThumb(null, "instagram", {
        fallback: true,
        ...(mediaType ? { mediaType } : {}),
      });
    }

    const isTikTok =
      /tiktok\.com\/@[\w.-]+\/(?:video|photo)\/\d+/i.test(url) ||
      /(vm|vt)\.tiktok\.com\/[\w-]+\/?/i.test(url) ||
      /tiktok\.com\/t\/[\w-]+/i.test(url) ||
      /tiktok\.com\/.*\/(?:video|photo)\/\d+/i.test(url) ||
      url.toLowerCase().includes("tiktok.com");

    if (isTikTok) {
      const { thumbnail: thumb, mediaType } = await resolveTikTokThumbnail(url);
      if (thumb && !isGenericLogoThumbnail(thumb)) {
        const finalUrl = await persistAndCache(cleanUrl, "tiktok", thumb, mediaType);
        return jsonThumb(finalUrl, "tiktok", {
          ...(mediaType ? { mediaType } : {}),
        });
      }
      return jsonThumb(null, "tiktok", {
        fallback: true,
        ...(mediaType ? { mediaType } : {}),
      });
    }

    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) {
      try {
        const vimeoResponse = await fetch(`https://vumbnail.com/${vimeoMatch[1]}.json`, {
          signal: AbortSignal.timeout(8000),
        });
        if (vimeoResponse.ok) {
          const vimeoData = (await vimeoResponse.json()) as { thumbnail_url?: string };
          if (vimeoData.thumbnail_url) {
            await saveThumbnailCache(cleanUrl, vimeoData.thumbnail_url, "vimeo", "video");
            return jsonThumb(vimeoData.thumbnail_url, "vimeo", { mediaType: "video" });
          }
        }
      } catch {
        /* ignore */
      }
    }

    return jsonThumb(null, "unknown");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Thumbnail fetch error:", error);
    return NextResponse.json({ error: message, thumbnail: null }, { status: 500 });
  }
}
