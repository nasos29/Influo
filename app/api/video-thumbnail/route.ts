import { NextRequest, NextResponse } from 'next/server';

// Get video thumbnail for various platforms
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  try {
    // YouTube - direct thumbnail URL
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const youtubeMatch = url.match(youtubeRegex);
    if (youtubeMatch) {
      return NextResponse.json({ 
        thumbnail: `https://img.youtube.com/vi/${youtubeMatch[1]}/maxresdefault.jpg`,
        platform: 'youtube'
      });
    }

    // Instagram Reels/Posts
    const instagramRegex = /instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/;
    const instagramMatch = url.match(instagramRegex);
    if (instagramMatch) {
      try {
        // Try to fetch from Instagram oEmbed API
        // Note: Instagram oEmbed requires authentication for most content, but let's try
        const oembedUrl = `https://api.instagram.com/oembed?url=${encodeURIComponent(url)}`;
        const response = await fetch(oembedUrl);
        
        if (response.ok) {
          const data = await response.json();
          if (data.thumbnail_url) {
            return NextResponse.json({ 
              thumbnail: data.thumbnail_url,
              platform: 'instagram'
            });
          }
        }
      } catch (error) {
        console.error('Instagram oEmbed error:', error);
      }

      // Fallback: Construct Instagram thumbnail URL (may not always work)
      // Instagram doesn't provide public thumbnail URLs without oEmbed, so we return null
      // The frontend will handle this with a placeholder
      return NextResponse.json({ 
        thumbnail: null,
        platform: 'instagram',
        fallback: true
      });
    }

    // TikTok
    if (url.includes('tiktok.com')) {
      // TikTok doesn't provide public thumbnail API
      return NextResponse.json({ 
        thumbnail: null,
        platform: 'tiktok'
      });
    }

    // Vimeo
    const vimeoRegex = /vimeo\.com\/(\d+)/;
    const vimeoMatch = url.match(vimeoRegex);
    if (vimeoMatch) {
      try {
        const vimeoResponse = await fetch(`https://vumbnail.com/${vimeoMatch[1]}.json`);
        if (vimeoResponse.ok) {
          const vimeoData = await vimeoResponse.json();
          if (vimeoData.thumbnail_url) {
            return NextResponse.json({ 
              thumbnail: vimeoData.thumbnail_url,
              platform: 'vimeo'
            });
          }
        }
      } catch (error) {
        console.error('Vimeo thumbnail error:', error);
      }
    }

    // If no match or error, return null
    return NextResponse.json({ 
      thumbnail: null,
      platform: 'unknown'
    });

  } catch (error: any) {
    console.error('Thumbnail fetch error:', error);
    return NextResponse.json({ 
      error: error.message,
      thumbnail: null
    }, { status: 500 });
  }
}

