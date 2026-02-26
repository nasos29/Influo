/**
 * Image proxy to reduce Supabase Storage egress.
 * Fetches images from Supabase once, returns with long cache so subsequent
 * requests are served from Next/Vercel cache instead of hitting Supabase again.
 * Only allows URLs from our Supabase project (allowlist).
 */

import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const CACHE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function GET(request: NextRequest) {
  const urlParam = request.nextUrl.searchParams.get('url');
  if (!urlParam) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(urlParam);
  } catch {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
  }

  if (!SUPABASE_URL) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const allowedOrigin = SUPABASE_URL.replace(/\/$/, '');
  if (!decoded.startsWith(allowedOrigin)) {
    return NextResponse.json({ error: 'URL not allowed' }, { status: 403 });
  }

  try {
    const res = await fetch(decoded, {
      cache: 'force-cache',
      next: { revalidate: CACHE_MAX_AGE },
    });

    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const body = await res.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': `public, max-age=${CACHE_MAX_AGE}, s-maxage=${CACHE_MAX_AGE}, stale-while-revalidate=86400`,
      },
    });
  } catch (e) {
    console.error('[image-proxy]', e);
    return NextResponse.json({ error: 'Fetch failed' }, { status: 502 });
  }
}
