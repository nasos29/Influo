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
              // Iframely returns thumbnail in various formats
              if (iframelyData.thumbnail || iframelyData.thumbnail_url || (iframelyData.links && iframelyData.links.thumbnail && iframelyData.links.thumbnail[0])) {
                const thumbnailUrl = iframelyData.thumbnail || iframelyData.thumbnail_url || iframelyData.links?.thumbnail?.[0]?.href;
                if (thumbnailUrl) {
                  return NextResponse.json({ 
                    thumbnail: thumbnailUrl,
                    platform: 'instagram'
                  });
                }
              }
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
              return NextResponse.json({ 
                thumbnail: data.thumbnail_url,
                platform: 'instagram'
              });
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
                  return NextResponse.json({ 
                    thumbnail: fullImageUrl,
                    platform: 'instagram'
                  });
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
                return NextResponse.json({ 
                  thumbnail: thumbnailUrl,
                  platform: 'tiktok'
                });
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
                  return NextResponse.json({ 
                    thumbnail: fullImageUrl,
                    platform: 'tiktok'
                  });
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

