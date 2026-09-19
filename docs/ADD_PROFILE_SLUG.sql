-- Pretty public profile URLs: https://influo.gr/in/your-name
-- Run in Supabase SQL Editor.

ALTER TABLE influencers
  ADD COLUMN IF NOT EXISTS profile_slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS influencers_profile_slug_unique
  ON influencers (profile_slug)
  WHERE profile_slug IS NOT NULL;

COMMENT ON COLUMN influencers.profile_slug IS 'Public vanity slug for /in/{slug} links.';
