-- Rate card (Story / Post / Reel / YouTube / Facebook package prices)
-- Required by influencer signup + dashboard edit. Without this column,
-- signup creates an auth user then fails on influencers insert → Profile Not Found.

ALTER TABLE influencers
  ADD COLUMN IF NOT EXISTS rate_card jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN influencers.rate_card IS 'Optional package prices: { story, post, reel, youtube, facebook }';
