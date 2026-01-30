import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const CACHE_DAYS = 30;

/** Save thumbnail to DB cache (if table exists). */
async function saveThumbnailCache(originalUrl: string, thumbnailUrl: string | null, platform: string) {
  if (!thumbnailUrl) return;
  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + CACHE_DAYS);
    await supabaseAdmin.from('video_thumbnail_cache').upsert(
      {
        original_url: originalUrl,
        thumbnail_url: thumbnailUrl,
        platform: platform,
        cached_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      },
      { onConflict: 'original_url' }
    );
  } catch {
    // Table might not exist
  }
}

// Get video thumbnail for various platforms
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  const cleanUrl = url.split('?')[0].split('#')[0].trim();

  try {
    // 1. Check DB cache first (λιγότερες κλήσεις Iframely)
    try {
      const { data: cached, error: cacheError } = await supabaseAdmin
        .from('video_thumbnail_cache')
        .select('thumbnail_url, platform, expires_at')
        .eq('original_url', cleanUrl)
        .single();
      if (!cacheError && cached && cached.thumbnail_url) {
        const expiresAt = new Date(cached.expires_at);
        if (expiresAt > new Date()) {
          const res = NextResponse.json({
            thumbnail: cached.thumbnail_url,
            platform: cached.platform || 'unknown',
          });
          res.headers.set('Cache-Control', 'public, max-age=604800, s-maxage=604800');
          return res;
        }
        await supabaseAdmin.from('video_thumbnail_cache').delete().eq('original_url', cleanUrl);
      }
    } catch {
      // Table might not exist
    }

    // YouTube - direct thumbnail URL (no Iframely, no cache needed)
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
      const postId = instagramMatch[1];
      const cleanUrl = url.split('?')[0];
      
      try {
        // Method 1: Try Iframely API (best option with API key)
        const iframelyApiKey = process.env.IFRAMELY_API_KEY || '4355c593a3b2439820d35f';
        if (iframelyApiKey) {
          try {
            const iframelyUrl = `https://iframe.ly/api/iframely?url=${encodeURIComponent(cleanUrl)}&api_key=${iframelyApiKey}`;
            const iframelyResponse = await fetch(iframelyUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
              }
            });
            
            if (iframelyResponse.ok) {
              const iframelyData = await iframelyResponse.json();
              
              // Iframely returns thumbnail in various formats - check all possible locations
              let thumbnailUrl = null;
              
              // Method 1: Direct thumbnail field
              if (iframelyData.thumbnail) {
                thumbnailUrl = iframelyData.thumbnail;
              }
              // Method 2: thumbnail_url field
              else if (iframelyData.thumbnail_url) {
                thumbnailUrl = iframelyData.thumbnail_url;
              }
              // Method 3: meta.thumbnail
              else if (iframelyData.meta?.thumbnail) {
                thumbnailUrl = iframelyData.meta.thumbnail;
              }
              // Method 4: links.thumbnail array (first item)
              else if (iframelyData.links?.thumbnail && Array.isArray(iframelyData.links.thumbnail) && iframelyData.links.thumbnail.length > 0) {
                thumbnailUrl = iframelyData.links.thumbnail[0].href || iframelyData.links.thumbnail[0];
              }
              // Method 5: links.icon (sometimes thumbnail is here)
              else if (iframelyData.links?.icon && Array.isArray(iframelyData.links.icon) && iframelyData.links.icon.length > 0) {
                const icon = iframelyData.links.icon[0];
                thumbnailUrl = icon.href || icon;
              }
              // Method 6: Check for image in links
              else if (iframelyData.links?.image && Array.isArray(iframelyData.links.image) && iframelyData.links.image.length > 0) {
                thumbnailUrl = iframelyData.links.image[0].href || iframelyData.links.image[0];
              }
              
              if (thumbnailUrl) {
                console.log('Instagram thumbnail found via Iframely:', thumbnailUrl);
                
                // Check if the thumbnail URL is from Instagram CDN (might be blocked)
                const isCDNUrl = thumbnailUrl.includes('cdninstagram.com') || thumbnailUrl.includes('scontent.cdninstagram.com');
                
                // If it's a CDN URL, try to find alternative thumbnail sources from Iframely
                if (isCDNUrl) {
                  // Try to find alternative image sources that might not be CDN
                  let alternativeUrl = null;
                  
                  // Check links.image for alternatives
                  if (iframelyData.links?.image && Array.isArray(iframelyData.links.image)) {
                    for (const img of iframelyData.links.image) {
                      const imgUrl = img.href || img;
                      if (imgUrl && !imgUrl.includes('cdninstagram.com') && !imgUrl.includes('scontent.cdninstagram.com')) {
                        alternativeUrl = imgUrl;
                        break;
                      }
                    }
                  }
                  
                  // If we found an alternative, use it; otherwise use the CDN URL (will be proxied)
                  if (alternativeUrl) {
                    console.log('Using alternative thumbnail URL (non-CDN):', alternativeUrl);
                    thumbnailUrl = alternativeUrl;
                  } else {
                    console.log('Using CDN thumbnail URL (will be proxied):', thumbnailUrl);
                  }
                }
                
                await saveThumbnailCache(cleanUrl, thumbnailUrl, 'instagram');
                const res = NextResponse.json({ 
                  thumbnail: thumbnailUrl,
                  platform: 'instagram',
                  isCDN: isCDNUrl
                });
                res.headers.set('Cache-Control', 'public, max-age=86400, s-maxage=604800');
                return res;
              } else {
                // Log for debugging - check what Iframely actually returned
                console.log('Iframely response for Instagram (no thumbnail found):', JSON.stringify(iframelyData, null, 2));
                console.log('Iframely links structure:', JSON.stringify(iframelyData.links, null, 2));
                console.log('Iframely meta structure:', JSON.stringify(iframelyData.meta, null, 2));
              }
            } else {
              const errorText = await iframelyResponse.text();
              console.log('Iframely API error for Instagram:', iframelyResponse.status, errorText);
            }
          } catch (e) {
            console.log('Iframely API failed, trying other methods...', e);
          }
        }

        // Method 2: Try Instagram oEmbed API (works for public posts)
        try {
          const oembedUrl = `https://api.instagram.com/oembed?url=${encodeURIComponent(cleanUrl)}`;
          const response = await fetch(oembedUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/json'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.thumbnail_url) {
              await saveThumbnailCache(cleanUrl, data.thumbnail_url, 'instagram');
              const res = NextResponse.json({ thumbnail: data.thumbnail_url, platform: 'instagram' });
              res.headers.set('Cache-Control', 'public, max-age=86400, s-maxage=604800');
              return res;
            }
          }
        } catch (e) {
          console.log('oEmbed failed, trying other methods...');
        }

        // Method 2: Try to fetch the page and extract og:image meta tag
        try {
          const pageResponse = await fetch(cleanUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'Accept-Encoding': 'gzip, deflate, br',
            },
            redirect: 'follow'
          });
          
          if (pageResponse.ok) {
            const html = await pageResponse.text();
            // Extract og:image from meta tags - try multiple patterns
            const patterns = [
              /property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
              /content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
              /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
              /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
            ];
            
            for (const pattern of patterns) {
              const match = html.match(pattern);
              if (match && match[1]) {
                const imageUrl = match[1].trim();
                if (imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('//'))) {
                  const fullImageUrl = imageUrl.startsWith('//') ? `https:${imageUrl}` : imageUrl;
                  await saveThumbnailCache(cleanUrl, fullImageUrl, 'instagram');
                  const res = NextResponse.json({ thumbnail: fullImageUrl, platform: 'instagram' });
                  res.headers.set('Cache-Control', 'public, max-age=86400, s-maxage=604800');
                  return res;
                }
              }
            }
          }
        } catch (e) {
          console.log('Page fetch failed, trying CDN patterns...');
        }

        // Method 3: Try Instagram CDN patterns (may work for some posts)
        // Instagram sometimes uses these patterns for media
        const cdnPatterns = [
          `https://scontent.cdninstagram.com/v/t51.2885-15/${postId}_n.jpg`,
          `https://www.instagram.com/p/${postId}/media/?size=l`,
        ];
        
        // Return first pattern as potential thumbnail (frontend will validate)
        // Note: These may not always work due to Instagram's restrictions
        return NextResponse.json({ 
          thumbnail: null, // Will use placeholder
          platform: 'instagram',
          fallback: true,
          embed_url: `https://www.instagram.com/p/${postId}/embed/`
        });
      } catch (error) {
        console.error('Instagram thumbnail error:', error);
        return NextResponse.json({ 
          thumbnail: null,
          platform: 'instagram',
          fallback: true
        });
      }
    }

    // TikTok - support both full URLs and short URLs (vm.tiktok.com, vt.tiktok.com)
    const tiktokRegex = /tiktok\.com\/@[\w.-]+\/video\/\d+/i;
    const tiktokShortRegex = /(vm|vt)\.tiktok\.com\/[\w-]+\/?/i;
    const tiktokMatch = url.match(tiktokRegex);
    const tiktokShortMatch = url.match(tiktokShortRegex);
    if (tiktokMatch || tiktokShortMatch || url.includes('tiktok.com')) {
      const cleanUrl = url.split('?')[0].split('#')[0]; // Remove query parameters and hash
      
      try {
        // Use Iframely API for TikTok thumbnails (best option)
        const iframelyApiKey = process.env.IFRAMELY_API_KEY || '4355c593a3b2439820d35f';
        if (iframelyApiKey) {
          try {
            const iframelyUrl = `https://iframe.ly/api/iframely?url=${encodeURIComponent(cleanUrl)}&api_key=${iframelyApiKey}`;
            const iframelyResponse = await fetch(iframelyUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
              }
            });
            
            if (iframelyResponse.ok) {
              const iframelyData = await iframelyResponse.json();
              
              // Iframely returns thumbnail in various formats - check all possible locations
              let thumbnailUrl = null;
              
              // Method 1: Direct thumbnail field
              if (iframelyData.thumbnail) {
                thumbnailUrl = iframelyData.thumbnail;
              }
              // Method 2: thumbnail_url field
              else if (iframelyData.thumbnail_url) {
                thumbnailUrl = iframelyData.thumbnail_url;
              }
              // Method 3: meta.thumbnail
              else if (iframelyData.meta?.thumbnail) {
                thumbnailUrl = iframelyData.meta.thumbnail;
              }
              // Method 4: links.thumbnail array (first item)
              else if (iframelyData.links?.thumbnail && Array.isArray(iframelyData.links.thumbnail) && iframelyData.links.thumbnail.length > 0) {
                thumbnailUrl = iframelyData.links.thumbnail[0].href || iframelyData.links.thumbnail[0];
              }
              // Method 5: links.icon (sometimes thumbnail is here)
              else if (iframelyData.links?.icon && Array.isArray(iframelyData.links.icon) && iframelyData.links.icon.length > 0) {
                const icon = iframelyData.links.icon[0];
                thumbnailUrl = icon.href || icon;
              }
              // Method 6: Check for image in links
              else if (iframelyData.links?.image && Array.isArray(iframelyData.links.image) && iframelyData.links.image.length > 0) {
                thumbnailUrl = iframelyData.links.image[0].href || iframelyData.links.image[0];
              }
              
              if (thumbnailUrl) {
                console.log('TikTok thumbnail found via Iframely:', thumbnailUrl);
                await saveThumbnailCache(cleanUrl, thumbnailUrl, 'tiktok');
                const res = NextResponse.json({ thumbnail: thumbnailUrl, platform: 'tiktok' });
                res.headers.set('Cache-Control', 'public, max-age=86400, s-maxage=604800');
                return res;
              } else {
                // Log full response for debugging
                console.log('Iframely response for TikTok (no thumbnail found):', JSON.stringify(iframelyData, null, 2));
                console.log('Iframely links structure:', JSON.stringify(iframelyData.links, null, 2));
              }
            } else {
              const errorText = await iframelyResponse.text();
              console.log('Iframely API error for TikTok:', iframelyResponse.status, errorText);
            }
          } catch (e) {
            console.log('Iframely API failed for TikTok, trying other methods...', e);
          }
        }

        // Fallback: Try to fetch the page and extract og:image meta tag
        try {
          const pageResponse = await fetch(cleanUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'Accept-Encoding': 'gzip, deflate, br',
            },
            redirect: 'follow'
          });
          
          if (pageResponse.ok) {
            const html = await pageResponse.text();
            // Extract og:image from meta tags
            const patterns = [
              /property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
              /content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
              /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
              /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
            ];
            
            for (const pattern of patterns) {
              const match = html.match(pattern);
              if (match && match[1]) {
                const imageUrl = match[1].trim();
                if (imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('//'))) {
                  const fullImageUrl = imageUrl.startsWith('//') ? `https:${imageUrl}` : imageUrl;
                  await saveThumbnailCache(cleanUrl, fullImageUrl, 'tiktok');
                  const res = NextResponse.json({ thumbnail: fullImageUrl, platform: 'tiktok' });
                  res.headers.set('Cache-Control', 'public, max-age=86400, s-maxage=604800');
                  return res;
                }
              }
            }
          }
        } catch (e) {
          console.log('Page fetch failed for TikTok...');
        }
        
        // If all methods fail, return null (will show placeholder)
        return NextResponse.json({ 
          thumbnail: null,
          platform: 'tiktok',
          fallback: true
        });
      } catch (error) {
        console.error('TikTok thumbnail error:', error);
        return NextResponse.json({ 
          thumbnail: null,
          platform: 'tiktok',
          fallback: true
        });
      }
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
            await saveThumbnailCache(cleanUrl, vimeoData.thumbnail_url, 'vimeo');
            const res = NextResponse.json({ thumbnail: vimeoData.thumbnail_url, platform: 'vimeo' });
            res.headers.set('Cache-Control', 'public, max-age=86400, s-maxage=604800');
            return res;
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

