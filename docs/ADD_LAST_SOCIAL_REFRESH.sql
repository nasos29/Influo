-- Track when each influencer's social stats were last refreshed (for monthly cron).
-- Run in Supabase SQL Editor.

ALTER TABLE influencers ADD COLUMN IF NOT EXISTS last_social_refresh_at TIMESTAMPTZ;

-- Optional: index for cron "refresh where last_social_refresh_at is null or < 30 days ago"
-- CREATE INDEX IF NOT EXISTS idx_influencers_last_social_refresh
-- ON influencers (last_social_refresh_at) WHERE last_social_refresh_at IS NOT NULL;
