import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveYouTubeVideoId } from "@/lib/videoThumbnailYoutube";
import {
  extractOgImageFromHtml,
  extractTikTokCoverFromHtml,
  isGenericLogoThumbnail,
} from "@/lib/videoThumbnailExtract";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const CACHE_DAYS_DEFAULT = 365;
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const FACEBOOK_UA = "facebookexternalhit/1.1";

function stripUrlNoise(url: string): string {
  return url.split("?")[0].split("#")[0].trim();
}

function cacheTtlMs(platform: string): number {
  if (platform === "tiktok" || platform === "instagram") {
    return 24 * 60 * 60 * 1000;
  }
  return CACHE_DAYS_DEFAULT * 24 * 60 * 60 * 1000;
}

/** Save thumbnail to DB cache (if table exists). Upsert overwrites logo / stale entries. */
async function saveThumbnailCache(
  originalUrl: string,
  thumbnailUrl: string | null,
  platform: string
) {
  if (!thumbnailUrl || isGenericLogoThumbnail(thumbnailUrl)) return;
  try {
    const expiresAt = new Date(Date.now() + cacheTtlMs(platform));
    await supabaseAdmin.from("video_thumbnail_cache").upsert(
      {
        original_url: originalUrl,
        thumbnail_url: thumbnailUrl,
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

function jsonThumb(thumbnail: string | null, platform: string, extra?: Record<string, unknown>) {
  const res = NextResponse.json({ thumbnail, platform, ...extra });
  const maxAge = platform === "tiktok" || platform === "instagram" ? 86400 : 31536000;
  res.headers.set("Cache-Control", `public, max-age=${maxAge}, s-maxage=${maxAge}`);
  return res;
}

/** Normalize any TikTok URL that contains /video|photo/{id} → canonical video URL. */
function tikTokCanonicalFromAny(url: string): string | null {
  const id = url.match(/\/(?:video|photo)\/(\d+)/)?.[1];
  if (!id) return null;
  const withUser = url.match(/tiktok\.com\/@([\w.-]+)\/(?:video|photo)\/(\d+)/i);
  if (withUser?.[1]) return `https://www.tiktok.com/@${withUser[1]}/video/${withUser[2]}`;
  return `https://www.tiktok.com/video/${id}`;
}

/**
 * Resolve vm/vt.tiktok.com → full /@user/video/ID (manual redirects, 5s timeout).
 */
async function resolveTikTokUrl(url: string): Promise<string> {
  const clean = stripUrlNoise(url);
  const already = tikTokCanonicalFromAny(clean);
  if (already) return already;
  if (!/(vm|vt)\.tiktok\.com/i.test(clean)) return clean;
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

async function resolveTikTokThumbnail(url: string): Promise<string | null> {
  const resolved = await resolveTikTokUrl(url);
  const oembed = await tikTokThumbnailViaOEmbed(resolved);
  if (oembed) return oembed;
  return tikTokThumbnailFromPage(resolved);
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

async function readCache(cleanUrl: string): Promise<{ thumbnail: string; platform: string } | null> {
  try {
    const { data: cached, error: cacheError } = await supabaseAdmin
      .from("video_thumbnail_cache")
      .select("thumbnail_url, platform, expires_at")
      .eq("original_url", cleanUrl)
      .single();
    if (cacheError || !cached?.thumbnail_url) return null;
    const expiresAt = new Date(cached.expires_at);
    if (!(expiresAt > new Date())) {
      await supabaseAdmin.from("video_thumbnail_cache").delete().eq("original_url", cleanUrl);
      return null;
    }
    const thumb = String(cached.thumbnail_url);
    // Cached generic logos are useless — ignore and re-fetch (upsert will overwrite).
    if (isGenericLogoThumbnail(thumb)) return null;
    return { thumbnail: thumb, platform: (cached.platform as string) || "unknown" };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "URL parameter is required" }, { status: 400 });
  }

  const cleanUrl = stripUrlNoise(url);

  try {
    const cached = await readCache(cleanUrl);
    if (cached) {
      return jsonThumb(cached.thumbnail, cached.platform);
    }

    const ytId = resolveYouTubeVideoId(url);
    if (ytId) {
      return jsonThumb(`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`, "youtube");
    }

    const instagramMatch = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/i);
    if (instagramMatch) {
      const thumb = await resolveInstagramThumbnail(url);
      if (thumb) {
        await saveThumbnailCache(cleanUrl, thumb, "instagram");
        return jsonThumb(thumb, "instagram");
      }
      return jsonThumb(null, "instagram", { fallback: true });
    }

    const isTikTok =
      /tiktok\.com\/@[\w.-]+\/video\/\d+/i.test(url) ||
      /(vm|vt)\.tiktok\.com\/[\w-]+\/?/i.test(url) ||
      /tiktok\.com\/.*\/(?:video|photo)\/\d+/i.test(url) ||
      url.toLowerCase().includes("tiktok.com");

    if (isTikTok) {
      const thumb = await resolveTikTokThumbnail(url);
      if (thumb && !isGenericLogoThumbnail(thumb)) {
        await saveThumbnailCache(cleanUrl, thumb, "tiktok");
        return jsonThumb(thumb, "tiktok");
      }
      return jsonThumb(null, "tiktok", { fallback: true });
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
            await saveThumbnailCache(cleanUrl, vimeoData.thumbnail_url, "vimeo");
            return jsonThumb(vimeoData.thumbnail_url, "vimeo");
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
