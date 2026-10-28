import { NextRequest, NextResponse } from "next/server";
import { isAllowedThumbnailHost } from "@/lib/thumbnailProxyHosts";
import { isValidInstagramShortcode } from "@/lib/instagramShortcode";

const CACHE_CONTROL =
  "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800";
const FETCH_TIMEOUT_MS = 8000;

function imageResponse(buffer: ArrayBuffer, contentType: string) {
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": CACHE_CONTROL,
      "Access-Control-Allow-Origin": "*",
    },
  });
}

async function fetchImage(imageUrl: string, withReferer: boolean) {
  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  };
  if (withReferer) {
    headers.Referer = "https://www.instagram.com/";
  }
  return fetch(imageUrl, {
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

async function fetchInstagramMediaByShortcode(shortcode: string) {
  const mediaUrl = `https://www.instagram.com/p/${shortcode}/media/?size=l`;
  return fetch(mediaUrl, {
    headers: {
      "User-Agent": "curl/8.5.0",
      Accept: "image/*,*/*;q=0.8",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

/** Proxy CDN thumbnails — allowlisted hosts, or Instagram shortcode via ?ig=. */
export async function GET(req: NextRequest) {
  const ig = req.nextUrl.searchParams.get("ig");
  const imageUrl = req.nextUrl.searchParams.get("url");

  try {
    if (ig) {
      if (!isValidInstagramShortcode(ig)) {
        return NextResponse.json({ error: "Invalid ig shortcode" }, { status: 400 });
      }
      const mediaRes = await fetchInstagramMediaByShortcode(ig);
      if (!mediaRes.ok) {
        return NextResponse.json(
          { error: `Failed to fetch Instagram media: ${mediaRes.status}` },
          { status: mediaRes.status }
        );
      }
      const imageBuffer = await mediaRes.arrayBuffer();
      const contentType = mediaRes.headers.get("content-type") || "image/jpeg";
      return imageResponse(imageBuffer, contentType);
    }

    if (!imageUrl) {
      return NextResponse.json({ error: "URL parameter is required" }, { status: 400 });
    }

    let urlObj: URL;
    try {
      urlObj = new URL(imageUrl);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    if (urlObj.protocol !== "https:" && urlObj.protocol !== "http:") {
      return NextResponse.json({ error: "URL not allowed" }, { status: 403 });
    }

    if (!isAllowedThumbnailHost(urlObj.hostname)) {
      return NextResponse.json({ error: "URL not allowed" }, { status: 403 });
    }

    let imageResponseFetch = await fetchImage(imageUrl, true);

    if (!imageResponseFetch.ok && imageResponseFetch.status === 403) {
      imageResponseFetch = await fetchImage(imageUrl, false);
    }

    if (!imageResponseFetch.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image: ${imageResponseFetch.status}` },
        { status: imageResponseFetch.status }
      );
    }

    const imageBuffer = await imageResponseFetch.arrayBuffer();
    const contentType = imageResponseFetch.headers.get("content-type") || "image/jpeg";
    return imageResponse(imageBuffer, contentType);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[Thumbnail Proxy] Error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
