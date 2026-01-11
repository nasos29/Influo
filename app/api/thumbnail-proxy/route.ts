import { NextRequest, NextResponse } from 'next/server';

// Proxy endpoint to fetch and serve thumbnails (especially for Instagram CDN URLs that block direct access)
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  try {
    // Validate that the URL is from a trusted source (Instagram CDN, TikTok CDN, etc.)
    const allowedDomains = [
      'cdninstagram.com',
      'scontent.cdninstagram.com',
      'instagram.com',
      'tiktokcdn.com',
      'tiktokcdn-us.com',
      'ibytedtos.com',
    ];

    const urlObj = new URL(imageUrl);
    const isAllowed = allowedDomains.some(domain => urlObj.hostname.includes(domain));

    if (!isAllowed) {
      return NextResponse.json({ error: 'URL not allowed' }, { status: 403 });
    }

    // Fetch the image from the source
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.instagram.com/',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      },
      // Don't follow redirects for security
      redirect: 'follow',
    });

    if (!imageResponse.ok) {
      console.error(`[Thumbnail Proxy] Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`);
      return NextResponse.json(
        { error: `Failed to fetch image: ${imageResponse.status}` },
        { status: imageResponse.status }
      );
    }

    // Get the image data
    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

    // Return the image with appropriate headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    console.error('[Thumbnail Proxy] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}