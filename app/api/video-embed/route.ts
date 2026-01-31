import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const IFRAMELY_API_KEY = process.env.IFRAMELY_API_KEY || process.env.NEXT_PUBLIC_IFRAMELY_API_KEY || '4355c593a3b2439820d35f';

// Create admin client for database operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const IFRAMELY_API_URL = 'https://iframe.ly/api/iframe';

interface CachedEmbed {
  original_url: string;
  embed_url: string;
  provider: string;
  cached_at: string;
  expires_at: string;
}

/**
 * GET /api/video-embed?url={originalUrl}
 * Returns cached embed URL or fetches from Iframely if not cached
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const originalUrl = searchParams.get('url');

    if (!originalUrl) {
      return NextResponse.json(
        { error: 'URL parameter is required' },
        { status: 400 }
      );
    }

    // Check cache in database
    try {
      const { data: cached, error: cacheError } = await supabaseAdmin
        .from('video_embed_cache')
        .select('*')
        .eq('original_url', originalUrl)
        .single();

      if (!cacheError && cached) {
        // Check if cache is still valid (30 days in DB)
        const expiresAt = new Date(cached.expires_at);
        const now = new Date();
        
        if (expiresAt > now) {
          // Cache is valid, return cached embed URL (max TTL to minimize Iframely API hits)
          const res = NextResponse.json({
            embed_url: cached.embed_url,
            provider: cached.provider,
            cached: true,
            cached_at: cached.cached_at
          });
          res.headers.set('Cache-Control', 'public, max-age=31536000, s-maxage=31536000'); // 1 year
          return res;
        }
        // Expired: re-fetch below; do not delete so we can upsert again
      }
    } catch (dbError) {
      // If table doesn't exist, continue to fetch from Iframely
      console.log('Cache check failed (table might not exist):', dbError);
    }

    // Cache miss or expired - fetch from Iframely
    const iframelyUrl = `${IFRAMELY_API_URL}?url=${encodeURIComponent(originalUrl)}&api_key=${IFRAMELY_API_KEY}`;
    
    const iframelyResponse = await fetch(iframelyUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    if (!iframelyResponse.ok) {
      const errorText = await iframelyResponse.text();
      console.error('Iframely API error:', iframelyResponse.status, errorText);
      return NextResponse.json(
        { error: 'Failed to fetch embed from Iframely', status: iframelyResponse.status },
        { status: iframelyResponse.status }
      );
    }

    // Iframely returns an HTML page with an iframe
    // The embed URL is the iframely URL itself, which will be used as iframe src
    // This URL contains the API key and original URL, and Iframely serves the embed HTML
    const embedUrl = iframelyUrl;

    // Detect provider from original URL
    let provider = 'unknown';
    const lowerUrl = originalUrl.toLowerCase();
    if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
      provider = 'youtube';
    } else if (lowerUrl.includes('instagram.com')) {
      provider = 'instagram';
    } else if (lowerUrl.includes('tiktok.com') || lowerUrl.includes('vm.tiktok.com') || lowerUrl.includes('vt.tiktok.com')) {
      provider = 'tiktok';
    }

    // Cache the result in database (max TTL to minimize Iframely API hits)
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 365); // 1 year

      await supabaseAdmin
        .from('video_embed_cache')
        .upsert({
          original_url: originalUrl,
          embed_url: embedUrl,
          provider: provider,
          cached_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString()
        }, {
          onConflict: 'original_url'
        });
    } catch (dbError) {
      // If table doesn't exist, continue without caching
      console.log('Cache save failed (table might not exist):', dbError);
    }

    const res = NextResponse.json({
      embed_url: embedUrl,
      provider: provider,
      cached: false
    });
    res.headers.set('Cache-Control', 'public, max-age=31536000, s-maxage=31536000'); // 1 year
    return res;

  } catch (error: any) {
    console.error('Error in video-embed:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
