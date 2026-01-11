-- Add video_thumbnails column to store manual thumbnail URLs
-- This is a JSONB object mapping video URLs to thumbnail URLs
-- Example: {"https://instagram.com/p/ABC123/": "https://example.com/thumb.jpg"}

ALTER TABLE influencers ADD COLUMN IF NOT EXISTS video_thumbnails JSONB DEFAULT '{}'::JSONB;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_influencers_video_thumbnails ON influencers USING GIN (video_thumbnails);
