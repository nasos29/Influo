# Video Embed Cache Setup

## Overview

This system caches resolved embed URLs for social video links to reduce upstream API calls and improve performance. When a video URL (Instagram, TikTok, YouTube) is requested, the system first checks the cache. If found and not expired, it returns the cached embed URL. Otherwise, it resolves the embed and caches the result.

## Benefits

- **Reduced API Calls**: Each video URL is only resolved once every 7 days (or longer for stable providers)
- **Faster Load Times**: Cached embeds load instantly without waiting for upstream services
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

1. **Client Request**: When `SocialEmbedCard` loads, it uses `getVideoEmbedApiUrl()` which returns an official Instagram/YouTube embed URL when possible, or `/api/video-embed?url={originalUrl}` for TikTok (and short-link resolve).

2. **API Endpoint**: The `/api/video-embed` endpoint:
   - Checks the `video_embed_cache` table for existing cache
   - If found and not expired, returns cached embed URL
   - If not found or expired, resolves the embed (official player / short-link redirect)
   - Caches the result in the database
   - Returns the embed URL

3. **Component**: `SocialEmbedCard` displays a click-to-load facade; the iframe loads only after the user taps play.

## Cache Expiration

- **Default**: 30 days (DB)
- **Response headers**: `Cache-Control: public, max-age=604800, s-maxage=604800` (7 days) so Cloudflare/CDN can cache at edge
- **Automatic Cleanup**: Expired entries are deleted when accessed
- **Manual Cleanup**: Run `cleanup_expired_embed_cache()` function to clean up all expired entries

## API Endpoints

### GET `/api/video-embed?url={originalUrl}`

Returns cached or freshly resolved embed URL.

**Response:**
```json
{
  "embed_url": "https://www.tiktok.com/player/v1/7123...?autoplay=1&muted=1",
  "provider": "tiktok",
  "cached": true,
  "cached_at": "2024-01-01T00:00:00Z"
}
```

## Usage

The cache is automatically used when:
- `SocialEmbedCard` component is rendered
- `getVideoEmbedApiUrl()` routes TikTok (and unresolved short links) through `/api/video-embed`
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
2. **Check logs**: Look for errors in server logs when resolving embeds

### Cache not updating

- Cache expires after 30 days automatically
- To force refresh, delete the cache entry:
  ```sql
  DELETE FROM video_embed_cache WHERE original_url = 'https://...';
  ```

### Performance

- Cache lookups are fast (indexed on `original_url`)
- Upstream resolve calls only happen on cache miss
- **Cloudflare**: `/api/video-embed` sends `Cache-Control` so Cloudflare can keep the response at the edge. Optional Cache Rule: path `/api/video-embed*` → Cache Level = Standard, Edge TTL = 7 days.

### Thumbnail cache (video-thumbnail API)

`/api/video-thumbnail?url=...` uses a **DB cache** so thumbnails are not re-fetched every time:

1. **Table**: `video_thumbnail_cache` (original_url, thumbnail_url, platform, expires_at). Create with `docs/ADD_VIDEO_THUMBNAIL_CACHE.sql`.
2. **Flow**: (1) Check cache by normalized URL. If present and not expired, return cached thumbnail + `Cache-Control`. (2) Otherwise resolve via oEmbed/page OG image, store in cache, return with `Cache-Control`.
3. **TTL**: shorter for Instagram/TikTok (1 day), longer for stable providers.
