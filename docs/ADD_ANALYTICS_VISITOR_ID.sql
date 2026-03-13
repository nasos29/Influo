-- Add visitor_id for unique-per-user analytics (anonymous visitors).
-- Run in Supabase SQL Editor.
-- Top influencers ranking then counts at most one event per (influencer, event_type, user) where user = brand_email or visitor_id.

ALTER TABLE influencer_analytics ADD COLUMN IF NOT EXISTS visitor_id TEXT;

COMMENT ON COLUMN influencer_analytics.visitor_id IS 'Anonymous visitor ID (e.g. from localStorage). Used with brand_email to count unique users per event for top-influencers ranking.';
