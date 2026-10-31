import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractInstagramShortcode, isValidInstagramShortcode } from "@/lib/instagramShortcode";
import {
  normalizeIgMediaUrl,
  resolveInstagramEmbedVideo,
} from "@/lib/instagramEmbedVideo";
import type { InstagramEmbedKind } from "@/lib/instagramMediaType";

const DAY_SEC = 86400;
const META_CACHE_DAYS = 1;
/** Bump when meta payload shape changes (e.g. images[]). */
const META_CACHE_PREFIX = "ig-meta:v2:";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function stripUrlNoise(url: string): string {
  return url.split("?")[0].split("#")[0].trim();
}

function metaCacheKey(cleanUrl: string): string {
  return `${META_CACHE_PREFIX}${cleanUrl}`;
}

type MetaPayload = {
  mediaType: InstagramEmbedKind;
  poster: string | null;
  images: string[];
};

function encodeMeta(meta: MetaPayload): string {
  return JSON.stringify({
    mediaType: meta.mediaType,
    poster: meta.poster,
    images: meta.images,
  });
}

function decodeMeta(raw: string): MetaPayload | null {
  try {
    const parsed = JSON.parse(String(raw || "")) as {
      mediaType?: unknown;
      poster?: unknown;
      images?: unknown;
    };
    const mt = parsed.mediaType;
    if (mt !== "video" && mt !== "image" && mt !== "carousel") return null;
    const posterRaw =
      typeof parsed.poster === "string" ? parsed.poster : null;
    const poster = posterRaw ? normalizeIgMediaUrl(posterRaw) || posterRaw : null;
    if (poster && !poster.startsWith("http")) return null;
    // Force refresh when legacy cache still has broken \% escapes.
    if (
      (typeof posterRaw === "string" && /\\[%&=]/.test(posterRaw)) ||
      (Array.isArray(parsed.images) &&
        parsed.images.some(
          (u) => typeof u === "string" && /\\[%&=]/.test(u)
        ))
    ) {
      return null;
    }
    const images = Array.isArray(parsed.images)
      ? parsed.images
          .map((u) =>
            typeof u === "string" ? normalizeIgMediaUrl(u) || u : null
          )
          .filter((u): u is string => typeof u === "string" && u.startsWith("http"))
          .slice(0, 10)
      : [];
    // Stale carousel cache without children — force refresh for images[].
    if (mt === "carousel" && images.length === 0) return null;
    return { mediaType: mt, poster: poster?.startsWith("http") ? poster : null, images };
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
 * - Default: { videoUrl, poster, mediaType, images } — videoUrl is short-lived (no store cache).
 * - ?meta=1: { mediaType, poster, images } only — cached 1 day (DB + CDN s-maxage).
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  const metaOnly = req.nextUrl.searchParams.get("meta") === "1";

  if (!url) {
    return jsonMeta(
      {
        error: "URL parameter is required",
        videoUrl: null,
        mediaType: null,
        poster: null,
        images: [],
      },
      false
    );
  }

  const code = extractInstagramShortcode(url);
  if (!code || !isValidInstagramShortcode(code)) {
    return jsonMeta(
      { videoUrl: null, poster: null, mediaType: null, images: [] },
      metaOnly
    );
  }

  const cleanUrl = stripUrlNoise(url);

  try {
    if (metaOnly) {
      const cached = await readMetaCache(cleanUrl);
      if (cached) {
        return jsonMeta(
          {
            mediaType: cached.mediaType,
            poster: cached.poster,
            images: cached.images,
            videoUrl: null,
          },
          true
        );
      }
    }

    const resolved = await resolveInstagramEmbedVideo(url);
    const mediaType = resolved.mediaType;
    const poster = resolved.poster;
    const images = resolved.images ?? [];

    if (mediaType) {
      void saveMetaCache(cleanUrl, { mediaType, poster, images });
    }

    if (metaOnly) {
      return jsonMeta(
        { mediaType, poster, images, videoUrl: null },
        !!mediaType
      );
    }

    return jsonMeta(
      {
        videoUrl: resolved.videoUrl,
        poster,
        mediaType,
        images,
      },
      false
    );
  } catch (e) {
    console.error("[instagram-video]", e);
    return jsonMeta(
      { videoUrl: null, poster: null, mediaType: null, images: [] },
      false
    );
  }
}
