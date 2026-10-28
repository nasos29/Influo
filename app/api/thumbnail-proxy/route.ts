import { NextRequest, NextResponse } from "next/server";
import { isAllowedThumbnailHost } from "@/lib/thumbnailProxyHosts";

const CACHE_CONTROL =
  "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800";

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
    signal: AbortSignal.timeout(10000),
  });
}

/** Proxy CDN thumbnails (Instagram / TikTok / YouTube) — allowlisted hosts only. */
export async function GET(req: NextRequest) {
  const imageUrl = req.nextUrl.searchParams.get("url");

  if (!imageUrl) {
    return NextResponse.json({ error: "URL parameter is required" }, { status: 400 });
  }

  try {
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
