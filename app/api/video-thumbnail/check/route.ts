import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

interface BrokenThumbnail {
  videoUrl: string;
  thumbnailUrl: string;
  reason: '404' | 'timeout' | 'network_error' | 'invalid_url';
}

/**
 * Check if thumbnails are still valid/accessible
 * POST /api/video-thumbnail/check
 * Body: { influencerId?: number, videoUrl?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { influencerId, videoUrl } = await request.json();

    if (!influencerId && !videoUrl) {
      return NextResponse.json(
        { error: 'influencerId or videoUrl is required' },
        { status: 400 }
      );
    }

    const brokenThumbnails: BrokenThumbnail[] = [];

    // If specific videoUrl provided, check just that one
    if (videoUrl) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        const response = await fetch(videoUrl, {
          method: 'HEAD',
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          brokenThumbnails.push({
            videoUrl: '',
            thumbnailUrl: videoUrl,
            reason: response.status === 404 ? '404' : 'network_error'
          });
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          brokenThumbnails.push({
            videoUrl: '',
            thumbnailUrl: videoUrl,
            reason: 'timeout'
          });
        } else {
          brokenThumbnails.push({
            videoUrl: '',
            thumbnailUrl: videoUrl,
            reason: 'network_error'
          });
        }
      }

      return NextResponse.json({
        broken: brokenThumbnails.length > 0,
        brokenThumbnails
      });
    }

    // If influencerId provided, check all thumbnails for that influencer
    if (influencerId) {
      const { data: influencer } = await supabaseAdmin
        .from('influencers')
        .select('video_thumbnails, videos')
        .eq('id', influencerId)
        .single();

      if (!influencer || !influencer.video_thumbnails) {
        return NextResponse.json({
          broken: false,
          brokenThumbnails: []
        });
      }

      const thumbnails = influencer.video_thumbnails as Record<string, string | { url: string; width?: number; height?: number; type?: string }>;
      const videos = Array.isArray(influencer.videos) ? influencer.videos : [];

      // Check each thumbnail
      for (const [vidUrl, thumbnail] of Object.entries(thumbnails)) {
        // Skip if video doesn't exist in videos array
        if (!videos.includes(vidUrl)) {
          continue;
        }

        let thumbnailUrl: string;
        if (typeof thumbnail === 'string') {
          thumbnailUrl = thumbnail;
        } else if (thumbnail && typeof thumbnail === 'object' && thumbnail.url) {
          thumbnailUrl = thumbnail.url;
        } else {
          continue;
        }

        // Skip empty URLs
        if (!thumbnailUrl || thumbnailUrl.trim() === '') {
          continue;
        }

        // Skip blob URLs (local previews)
        if (thumbnailUrl.startsWith('blob:')) {
          continue;
        }

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

          const response = await fetch(thumbnailUrl, {
            method: 'HEAD',
            signal: controller.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Referer': 'https://influo.gr/'
            }
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            brokenThumbnails.push({
              videoUrl: vidUrl,
              thumbnailUrl: thumbnailUrl,
              reason: response.status === 404 ? '404' : 'network_error'
            });
          }
        } catch (error: any) {
          if (error.name === 'AbortError') {
            brokenThumbnails.push({
              videoUrl: vidUrl,
              thumbnailUrl: thumbnailUrl,
              reason: 'timeout'
            });
          } else {
            // Network errors - mark as broken
            brokenThumbnails.push({
              videoUrl: vidUrl,
              thumbnailUrl: thumbnailUrl,
              reason: 'network_error'
            });
          }
        }
      }

      return NextResponse.json({
        broken: brokenThumbnails.length > 0,
        brokenThumbnails,
        total: Object.keys(thumbnails).length,
        brokenCount: brokenThumbnails.length
      });
    }

    return NextResponse.json({
      broken: false,
      brokenThumbnails: []
    });

  } catch (error: any) {
    console.error('Error checking thumbnails:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
