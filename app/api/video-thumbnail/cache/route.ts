import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

const IFRAMELY_API_KEY = process.env.IFRAMELY_API_KEY;
const IFRAMELY_API_URL = 'https://iframe.ly/api/iframely';

interface ThumbnailMetadata {
  url: string;
  width?: number;
  height?: number;
  type?: string;
}

interface CachedThumbnail {
  url: string;
  width?: number;
  height?: number;
  type?: string;
}

/**
 * Fetch thumbnail metadata from Iframely and cache it in database
 * POST /api/video-thumbnail/cache
 * Body: { videoUrl: string, influencerId?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const { videoUrl, influencerId } = await request.json();

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'videoUrl is required' },
        { status: 400 }
      );
    }

    if (!IFRAMELY_API_KEY) {
      return NextResponse.json(
        { error: 'IFRAMELY_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Fetch from Iframely
    const iframelyUrl = `${IFRAMELY_API_URL}?url=${encodeURIComponent(videoUrl)}&api_key=${IFRAMELY_API_KEY}`;
    const iframelyResponse = await fetch(iframelyUrl);
    
    if (!iframelyResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch from Iframely', status: iframelyResponse.status },
        { status: iframelyResponse.status }
      );
    }

    const iframelyData = await iframelyResponse.json();
    
    // Extract thumbnail metadata
    let thumbnailMetadata: ThumbnailMetadata | null = null;
    
    if (iframelyData.links?.thumbnail && iframelyData.links.thumbnail.length > 0) {
      const thumbnail = iframelyData.links.thumbnail[0]; // Use first thumbnail
      thumbnailMetadata = {
        url: thumbnail.href || thumbnail.url || '',
        width: thumbnail.media?.width || iframelyData.meta?.thumbnail_width,
        height: thumbnail.media?.height || iframelyData.meta?.thumbnail_height,
        type: thumbnail.type || thumbnail.media?.type || 'image/jpeg'
      };
    }

    if (!thumbnailMetadata || !thumbnailMetadata.url) {
      return NextResponse.json(
        { error: 'No thumbnail found in Iframely response' },
        { status: 404 }
      );
    }

    // If influencerId provided, cache in database
    if (influencerId) {
      try {
        // Get current video_thumbnails
        const { data: influencer } = await supabaseAdmin
          .from('influencers')
          .select('video_thumbnails')
          .eq('id', influencerId)
          .single();

        const currentThumbnails = influencer?.video_thumbnails || {};
        
        // Update with new metadata
        const updatedThumbnails = {
          ...currentThumbnails,
          [videoUrl]: thumbnailMetadata
        };

        // Save to database
        await supabaseAdmin
          .from('influencers')
          .update({ video_thumbnails: updatedThumbnails })
          .eq('id', influencerId);

      } catch (dbError) {
        console.error('Error caching thumbnail in database:', dbError);
        // Continue even if DB cache fails - we still return the thumbnail
      }
    }

    return NextResponse.json({
      success: true,
      thumbnail: thumbnailMetadata,
      cached: !!influencerId
    });

  } catch (error: any) {
    console.error('Error in video-thumbnail/cache:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
