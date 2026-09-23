import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const IFRAMELY_API_KEY = process.env.IFRAMELY_API_KEY || process.env.NEXT_PUBLIC_IFRAMELY_API_KEY;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const IFRAMELY_API_URL = 'https://iframe.ly/api/iframe';
const EMBED_CACHE_SECONDS = 60 * 60 * 24 * 365; // 1 year

function detectProvider(originalUrl: string): string {
  const lowerUrl = originalUrl.toLowerCase();
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return 'youtube';
  if (lowerUrl.includes('instagram.com')) return 'instagram';
  if (
    lowerUrl.includes('tiktok.com') ||
    lowerUrl.includes('vm.tiktok.com') ||
    lowerUrl.includes('vt.tiktok.com')
  ) {
    return 'tiktok';
  }
  return 'unknown';
}

/** Resolve TikTok short/full URL → numeric video id for official embed. */
async function resolveTikTokVideoId(url: string): Promise<string | null> {
  const clean = url.split('?')[0].split('#')[0].trim();
  const direct = clean.match(/\/video\/(\d+)/);
  if (direct) return direct[1];
  if (!/(vm|vt)\.tiktok\.com/i.test(clean)) return null;
  try {
    const res = await fetch(clean, {
      method: 'GET',
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    const loc = res.headers.get('location') || '';
    return loc.match(/\/video\/(\d+)/)?.[1] ?? null;
  } catch {
    return null;
  }
}

function isStaleTikTokCache(embedUrl: string): boolean {
  // Old caches pointed at Iframely proxy frames which often render black.
  return /iframe\.ly|frame=1/i.test(embedUrl);
}

/**
 * GET /api/video-embed?url={originalUrl}
 * - default mode: returns JSON with local embed URL (cached in DB)
 * - frame mode (?frame=1): proxies Iframely HTML via server (no API key leakage)
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const originalUrl = searchParams.get('url');
    const frameMode = searchParams.get('frame') === '1';

    if (!originalUrl) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
    }

    const provider = detectProvider(originalUrl);

    // TikTok: prefer official player (plays on-site). Do this before IFRAMELY_API_KEY check.
    if (provider === 'tiktok' && !frameMode) {
      const videoId = await resolveTikTokVideoId(originalUrl);
      if (videoId) {
        const embedUrl = `https://www.tiktok.com/embed/v2/${videoId}?autoplay=1`;
        try {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);
          await supabaseAdmin.from('video_embed_cache').upsert(
            {
              original_url: originalUrl,
              embed_url: embedUrl,
              provider: 'tiktok',
              cached_at: new Date().toISOString(),
              expires_at: expiresAt.toISOString(),
            },
            { onConflict: 'original_url' }
          );
        } catch {
          /* cache optional */
        }
        return NextResponse.json({
          embed_url: embedUrl,
          provider: 'tiktok',
          cached: false,
        });
      }
    }

    if (!IFRAMELY_API_KEY) {
      return NextResponse.json({ error: 'IFRAMELY_API_KEY not configured' }, { status: 500 });
    }

    // Frame mode for iframe src: fetch Iframely HTML server-side with key, return cached HTML.
    if (frameMode) {
      const iframelyFrameUrl = `${IFRAMELY_API_URL}?url=${encodeURIComponent(originalUrl)}&api_key=${IFRAMELY_API_KEY}`;
      const iframeRes = await fetch(iframelyFrameUrl, {
        cache: 'force-cache',
        next: { revalidate: EMBED_CACHE_SECONDS },
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!iframeRes.ok) {
        const txt = await iframeRes.text();
        console.error('Iframely frame fetch error:', iframeRes.status, txt);
        return NextResponse.json(
          { error: 'Failed to fetch iframe HTML', status: iframeRes.status },
          { status: iframeRes.status }
        );
      }

      const html = await iframeRes.text();
      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': `public, max-age=${EMBED_CACHE_SECONDS}, s-maxage=${EMBED_CACHE_SECONDS}, stale-while-revalidate=86400`,
        },
      });
    }

    // Default mode: DB cache lookup first
    try {
      const { data: cached, error: cacheError } = await supabaseAdmin
        .from('video_embed_cache')
        .select('*')
        .eq('original_url', originalUrl)
        .maybeSingle();

      if (!cacheError && cached) {
        const expiresAt = new Date(cached.expires_at);
        const staleTikTok =
          cached.provider === 'tiktok' && isStaleTikTokCache(String(cached.embed_url || ''));
        if (expiresAt > new Date() && !staleTikTok) {
          const res = NextResponse.json({
            embed_url: cached.embed_url,
            provider: cached.provider,
            cached: true,
            cached_at: cached.cached_at,
          });
          res.headers.set(
            'Cache-Control',
            `public, max-age=${EMBED_CACHE_SECONDS}, s-maxage=${EMBED_CACHE_SECONDS}`
          );
          return res;
        }
      }
    } catch (dbError) {
      console.log('Cache check failed (table might not exist):', dbError);
    }

    // Warm Iframely once server-side (helps detect failures early)
    const iframelyUrl = `${IFRAMELY_API_URL}?url=${encodeURIComponent(originalUrl)}&api_key=${IFRAMELY_API_KEY}`;
    const iframelyResponse = await fetch(iframelyUrl, {
      cache: 'force-cache',
      next: { revalidate: EMBED_CACHE_SECONDS },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!iframelyResponse.ok) {
      const errorText = await iframelyResponse.text();
      console.error('Iframely API error:', iframelyResponse.status, errorText);
      return NextResponse.json(
        { error: 'Failed to fetch embed from Iframely', status: iframelyResponse.status },
        { status: iframelyResponse.status }
      );
    }

    // Never expose API key to client.
    const embedUrl = `/api/video-embed?url=${encodeURIComponent(originalUrl)}&frame=1`;

    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 365);
      await supabaseAdmin.from('video_embed_cache').upsert(
        {
          original_url: originalUrl,
          embed_url: embedUrl,
          provider,
          cached_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        },
        { onConflict: 'original_url' }
      );
    } catch (dbError) {
      console.log('Cache save failed (table might not exist):', dbError);
    }

    const res = NextResponse.json({
      embed_url: embedUrl,
      provider,
      cached: false,
    });
    res.headers.set(
      'Cache-Control',
      `public, max-age=${EMBED_CACHE_SECONDS}, s-maxage=${EMBED_CACHE_SECONDS}`
    );
    return res;
  } catch (error: any) {
    console.error('Error in video-embed:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
