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
        // Method 1: Try Instagram oEmbed API (works for public posts)
        const oembedUrl = `https://api.instagram.com/oembed?url=${encodeURIComponent(url)}`;
        const response = await fetch(oembedUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.thumbnail_url) {
            return NextResponse.json({ 
              thumbnail: data.thumbnail_url,
              platform: 'instagram'
            });
          }
        }

        // Method 2: Try to fetch the page and extract og:image meta tag
        const pageResponse = await fetch(url.split('?')[0], {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        if (pageResponse.ok) {
          const html = await pageResponse.text();
          // Extract og:image from meta tags
          const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
          if (ogImageMatch && ogImageMatch[1]) {
            return NextResponse.json({ 
              thumbnail: ogImageMatch[1],
              platform: 'instagram'
            });
          }
          
          // Try alternative meta tag format
          const ogImageMatch2 = html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
          if (ogImageMatch2 && ogImageMatch2[1]) {
            return NextResponse.json({ 
              thumbnail: ogImageMatch2[1],
              platform: 'instagram'
            });
          }
        }
      } catch (error) {
        console.error('Instagram thumbnail error:', error);
      }

      // Fallback: Try constructing a thumbnail URL (Instagram CDN pattern)
      // This is a fallback that may work for some posts
      const postId = instagramMatch[1];
      const fallbackThumbnail = `https://www.instagram.com/p/${postId}/media/?size=l`;
      
      return NextResponse.json({ 
        thumbnail: fallbackThumbnail,
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

