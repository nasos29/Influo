# Video Embed Cache Setup

## Overview

This system caches embed URLs from Iframely API to reduce API calls and improve performance. When a video URL (Instagram, TikTok, YouTube) is requested, the system first checks the cache. If found and not expired, it returns the cached embed URL. Otherwise, it fetches from Iframely and caches the result.

## Benefits

- **Reduced API Calls**: Each video URL is only fetched from Iframely once every 7 days
- **Faster Load Times**: Cached embeds load instantly without waiting for Iframely API
- **Cost Savings**: Reduces Iframely API usage and potential rate limiting
- **Better Performance**: Less network latency for repeated video views

## Database Setup

Run the SQL script to create the cache table:

```sql
-- See docs/ADD_VIDEO_EMBED_CACHE.sql
```

Or run it directly in Supabase SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS video_embed_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_url TEXT NOT NULL UNIQUE,
  embed_url TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('youtube', 'instagram', 'tiktok', 'unknown')),
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_embed_cache_url ON video_embed_cache(original_url);
CREATE INDEX IF NOT EXISTS idx_video_embed_cache_expires ON video_embed_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_video_embed_cache_provider ON video_embed_cache(provider);
```

## How It Works

1. **Client Request**: When `SocialEmbedCard` component loads, it calls `getIframelyEmbedUrl()` which returns `/api/video-embed?url={originalUrl}`

2. **API Endpoint**: The `/api/video-embed` endpoint:
   - Checks the `video_embed_cache` table for existing cache
   - If found and not expired (< 7 days), returns cached embed URL
   - If not found or expired, fetches from Iframely API
   - Caches the result in database with 7-day expiration
   - Returns the embed URL

3. **Component**: `SocialEmbedCard` receives the API endpoint URL, fetches the cached embed URL, and displays it in an iframe

## Cache Expiration

- **Default**: 7 days
- **Automatic Cleanup**: Expired entries are deleted when accessed
- **Manual Cleanup**: Run `cleanup_expired_embed_cache()` function to clean up all expired entries

## API Endpoints

### GET `/api/video-embed?url={originalUrl}`

Returns cached or fresh embed URL from Iframely.

**Response:**
```json
{
  "embed_url": "https://iframe.ly/api/iframe?url=...&api_key=...",
  "provider": "instagram",
  "cached": true,
  "cached_at": "2024-01-01T00:00:00Z"
}
```

## Usage

The cache is automatically used when:
- `SocialEmbedCard` component is rendered
- `getIframelyEmbedUrl()` is called (client-side returns API endpoint)
- Any component uses the embed URL helper function

No code changes needed - the cache is transparent to existing code.

## Monitoring

To check cache statistics:

```sql
-- Count total cached embeds
SELECT COUNT(*) FROM video_embed_cache;

-- Count by provider
SELECT provider, COUNT(*) FROM video_embed_cache GROUP BY provider;

-- Count expired entries
SELECT COUNT(*) FROM video_embed_cache WHERE expires_at < NOW();

-- Clean up expired entries
SELECT cleanup_expired_embed_cache();
```

## Troubleshooting

### Cache not working

1. **Check table exists**: Run the SQL setup script
2. **Check API key**: Ensure `IFRAMELY_API_KEY` is set in environment variables
3. **Check logs**: Look for errors in server logs when fetching from Iframely

### Cache not updating

- Cache expires after 7 days automatically
- To force refresh, delete the cache entry:
  ```sql
  DELETE FROM video_embed_cache WHERE original_url = 'https://...';
  ```

### Performance

- Cache lookups are fast (indexed on `original_url`)
- Iframely API calls only happen on cache miss
- Consider increasing cache duration if videos don't change often
