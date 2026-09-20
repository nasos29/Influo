-- Optional: store post count on each follower snapshot so content growth can be charted later.
-- Run in Supabase SQL Editor. Refresh still works without this column.

ALTER TABLE influencer_follower_snapshots
  ADD COLUMN IF NOT EXISTS total_posts BIGINT;

COMMENT ON COLUMN influencer_follower_snapshots.total_posts IS 'Sum of account posts_count at snapshot time. Null until AuditPro starts returning posts.';
