import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractInstagramShortcode, isValidInstagramShortcode } from "@/lib/instagramShortcode";
import { resolveInstagramEmbedVideo } from "@/lib/instagramEmbedVideo";
import type { InstagramEmbedKind } from "@/lib/instagramMediaType";

const DAY_SEC = 86400;
const META_CACHE_DAYS = 1;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function stripUrlNoise(url: string): string {
  return url.split("?")[0].split("#")[0].trim();
}

function metaCacheKey(cleanUrl: string): string {
  return `ig-meta:${cleanUrl}`;
}

type MetaPayload = { mediaType: InstagramEmbedKind; poster: string | null };

function encodeMeta(meta: MetaPayload): string {
  return JSON.stringify({ mediaType: meta.mediaType, poster: meta.poster });
}

function decodeMeta(raw: string): MetaPayload | null {
  try {
    const parsed = JSON.parse(String(raw || "")) as {
      mediaType?: unknown;
      poster?: unknown;
    };
    const mt = parsed.mediaType;
    if (mt !== "video" && mt !== "image" && mt !== "carousel") return null;
    const poster =
      typeof parsed.poster === "string" && parsed.poster.startsWith("http")
        ? parsed.poster
        : null;
    return { mediaType: mt, poster };
  } catch {
    return null;
  }
}

async function readMetaCache(cleanUrl: string): Promise<MetaPayload | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("video_thumbnail_cache")
      .select("thumbnail_url, expires_at")
      .eq("original_url", metaCacheKey(cleanUrl))
      .maybeSingle();
    if (error || !data?.thumbnail_url) return null;
    if (!(new Date(data.expires_at) > new Date())) return null;
    return decodeMeta(String(data.thumbnail_url));
  } catch {
    return null;
  }
}

async function saveMetaCache(cleanUrl: string, meta: MetaPayload): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + META_CACHE_DAYS * DAY_SEC * 1000);
    await supabaseAdmin.from("video_thumbnail_cache").upsert(
      {
        original_url: metaCacheKey(cleanUrl),
        thumbnail_url: encodeMeta(meta),
        platform: "instagram",
        cached_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      },
      { onConflict: "original_url" }
    );
  } catch {
    /* table may be missing */
  }
}

function jsonMeta(body: Record<string, unknown>, cacheable: boolean) {
  const res = NextResponse.json(body);
  if (cacheable) {
    res.headers.set(
      "Cache-Control",
      `public, max-age=3600, s-maxage=${DAY_SEC}, stale-while-revalidate=86400`
    );
  } else {
    res.headers.set("Cache-Control", "private, max-age=0");
  }
  return res;
}

/**
 * Resolve Instagram media for in-page play / photo display.
 * - Default: { videoUrl, poster, mediaType } — videoUrl is short-lived (no store cache).
 * - ?meta=1: { mediaType, poster } only — cached 1 day (DB + CDN s-maxage).
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  const metaOnly = req.nextUrl.searchParams.get("meta") === "1";

  if (!url) {
    return jsonMeta(
      { error: "URL parameter is required", videoUrl: null, mediaType: null, poster: null },
      false
    );
  }

  const code = extractInstagramShortcode(url);
  if (!code || !isValidInstagramShortcode(code)) {
    return jsonMeta({ videoUrl: null, poster: null, mediaType: null }, metaOnly);
  }

  const cleanUrl = stripUrlNoise(url);

  try {
    if (metaOnly) {
      const cached = await readMetaCache(cleanUrl);
      if (cached) {
        return jsonMeta(
          { mediaType: cached.mediaType, poster: cached.poster, videoUrl: null },
          true
        );
      }
    }

    const resolved = await resolveInstagramEmbedVideo(url);
    const mediaType = resolved.mediaType;
    const poster = resolved.poster;

    if (mediaType) {
      void saveMetaCache(cleanUrl, { mediaType, poster });
    }

    if (metaOnly) {
      return jsonMeta({ mediaType, poster, videoUrl: null }, !!mediaType);
    }

    return jsonMeta(
      {
        videoUrl: resolved.videoUrl,
        poster,
        mediaType,
      },
      false
    );
  } catch (e) {
    console.error("[instagram-video]", e);
    return jsonMeta({ videoUrl: null, poster: null, mediaType: null }, false);
  }
}
