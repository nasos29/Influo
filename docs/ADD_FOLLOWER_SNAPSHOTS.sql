-- Store follower snapshots when social stats are refreshed (for 30-day growth).
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS influencer_follower_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_followers BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_follower_snapshots_influencer_at
  ON influencer_follower_snapshots (influencer_id, snapshot_at DESC);

COMMENT ON TABLE influencer_follower_snapshots IS 'One row per refresh: total followers at that time. Used to compute 30-day growth on profile.';
