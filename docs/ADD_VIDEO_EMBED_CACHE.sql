-- Create table for caching video embed URLs from Iframely
-- This reduces API calls to Iframely by caching embed URLs for 7 days

CREATE TABLE IF NOT EXISTS video_embed_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_url TEXT NOT NULL UNIQUE,
  embed_url TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('youtube', 'instagram', 'tiktok', 'unknown')),
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_video_embed_cache_url ON video_embed_cache(original_url);
CREATE INDEX IF NOT EXISTS idx_video_embed_cache_expires ON video_embed_cache(expires_at);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_video_embed_cache_provider ON video_embed_cache(provider);

-- Add comment
COMMENT ON TABLE video_embed_cache IS 'Caches embed URLs from Iframely API to reduce API calls. Embeds expire after 7 days.';

-- Optional: Create a function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_embed_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM video_embed_cache
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a scheduled job to run cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-embed-cache', '0 2 * * *', 'SELECT cleanup_expired_embed_cache()');
