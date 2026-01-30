-- Cache για thumbnails από /api/video-thumbnail (Instagram, TikTok, Vimeo κλπ).
-- Μειώνει κλήσεις στο Iframely: πρώτα ελέγχουμε cache, αν υπάρχει και δεν έχει λήξει επιστρέφουμε cached.

CREATE TABLE IF NOT EXISTS video_thumbnail_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_url TEXT NOT NULL UNIQUE,
  thumbnail_url TEXT,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'youtube', 'vimeo', 'unknown')),
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_thumbnail_cache_url ON video_thumbnail_cache(original_url);
CREATE INDEX IF NOT EXISTS idx_video_thumbnail_cache_expires ON video_thumbnail_cache(expires_at);

COMMENT ON TABLE video_thumbnail_cache IS 'Caches thumbnail URLs from Iframely/APIs. Expires after 30 days.';

CREATE OR REPLACE FUNCTION cleanup_expired_thumbnail_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM video_thumbnail_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
