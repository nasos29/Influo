-- Per-account follower totals on each snapshot so 15-day growth
-- can compare only platforms that still exist (ignore lost accounts).

ALTER TABLE public.influencer_follower_snapshots
  ADD COLUMN IF NOT EXISTS accounts jsonb;

COMMENT ON COLUMN public.influencer_follower_snapshots.accounts IS
  'Per-account follower totals at snapshot time: [{platform, username, followers}]. Used so 15-day growth ignores removed accounts.';
