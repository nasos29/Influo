/**
 * Image proxy to cut Supabase Storage egress.
 * Streams the upstream body and sets long CDN cache headers so Vercel serves
 * repeats from the edge without re-running this function.
 */

import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/$/, "");
const YEAR = 60 * 60 * 24 * 365;

const ALLOWED_PREFIXES = [
  "/storage/v1/object/public/",
  "/storage/v1/render/image/public/",
] as const;

function errorResponse(status: number, message: string): NextResponse {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "public, s-maxage=60, max-age=60",
        "CDN-Cache-Control": "public, s-maxage=60",
        "Vercel-CDN-Cache-Control": "public, s-maxage=60",
      },
    }
  );
}

function isAllowedStorageUrl(decoded: string): boolean {
  if (!SUPABASE_URL || !decoded.startsWith(SUPABASE_URL)) return false;
  try {
    const path = new URL(decoded).pathname;
    return ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix));
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const urlParam = request.nextUrl.searchParams.get("url");
  if (!urlParam) return errorResponse(400, "Missing url parameter");

  let decoded: string;
  try {
    decoded = decodeURIComponent(urlParam);
  } catch {
    return errorResponse(400, "Invalid url");
  }

  if (!SUPABASE_URL) return errorResponse(500, "Server misconfiguration");
  if (!isAllowedStorageUrl(decoded)) return errorResponse(403, "URL not allowed");

  const ifNoneMatch = request.headers.get("if-none-match");

  try {
    const upstreamHeaders: HeadersInit = {};
    if (ifNoneMatch) upstreamHeaders["If-None-Match"] = ifNoneMatch;

    const res = await fetch(decoded, {
      headers: upstreamHeaders,
      // No Next data-cache hop — rely on CDN Cache-Control below.
      cache: "no-store",
    });

    if (res.status === 304) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          "Cache-Control": `public, max-age=${YEAR}, immutable`,
          "CDN-Cache-Control": `public, s-maxage=${YEAR}`,
          "Vercel-CDN-Cache-Control": `public, s-maxage=${YEAR}`,
          ...(res.headers.get("etag") ? { ETag: res.headers.get("etag")! } : {}),
          ...(res.headers.get("last-modified")
            ? { "Last-Modified": res.headers.get("last-modified")! }
            : {}),
        },
      });
    }

    if (!res.ok) {
      return new NextResponse(null, {
        status: res.status,
        headers: {
          "Cache-Control": "public, s-maxage=60, max-age=60",
          "CDN-Cache-Control": "public, s-maxage=60",
          "Vercel-CDN-Cache-Control": "public, s-maxage=60",
        },
      });
    }

    const contentType = res.headers.get("content-type") || "image/jpeg";
    const etag = res.headers.get("etag");
    const lastModified = res.headers.get("last-modified");

    if (ifNoneMatch && etag && ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Cache-Control": `public, max-age=${YEAR}, immutable`,
          "CDN-Cache-Control": `public, s-maxage=${YEAR}`,
          "Vercel-CDN-Cache-Control": `public, s-maxage=${YEAR}`,
          ...(lastModified ? { "Last-Modified": lastModified } : {}),
        },
      });
    }

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": `public, max-age=${YEAR}, immutable`,
      "CDN-Cache-Control": `public, s-maxage=${YEAR}`,
      "Vercel-CDN-Cache-Control": `public, s-maxage=${YEAR}`,
    };
    if (etag) headers.ETag = etag;
    if (lastModified) headers["Last-Modified"] = lastModified;

    // Stream — avoid buffering the whole image in the function.
    return new NextResponse(res.body, { status: 200, headers });
  } catch (e) {
    console.error("[image-proxy]", e);
    return errorResponse(502, "Fetch failed");
  }
}
