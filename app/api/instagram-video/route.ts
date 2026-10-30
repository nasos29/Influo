import { NextRequest, NextResponse } from "next/server";
import { extractInstagramShortcode, isValidInstagramShortcode } from "@/lib/instagramShortcode";
import { resolveInstagramEmbedVideo } from "@/lib/instagramEmbedVideo";

function noStoreJson(body: Record<string, unknown>, status = 200) {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "private, max-age=0");
  return res;
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
    const resolved = await resolveInstagramEmbedVideo(url);
    if (resolved.videoUrl) {
      return noStoreJson({ videoUrl: resolved.videoUrl, poster: resolved.poster });
    }
    return noStoreJson({ videoUrl: null, poster: resolved.poster });
  } catch (e) {
    console.error("[instagram-video]", e);
    return noStoreJson({ videoUrl: null, poster: null });
  }
}
