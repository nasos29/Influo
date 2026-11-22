-- Hold new-unapproved creators out of ApproveNew re-scrape after clear permanent missing-handle errors.
-- Cleared on successful apply or when handles / profile change after hold.

ALTER TABLE public.influencers
  ADD COLUMN IF NOT EXISTS wrong_username_held_at TIMESTAMPTZ;

ALTER TABLE public.influencers
  ADD COLUMN IF NOT EXISTS wrong_username_handles JSONB;

COMMENT ON COLUMN public.influencers.wrong_username_held_at IS
  'When set, ApproveNew skips re-scrape until profile_changes after this time or social handles change.';

COMMENT ON COLUMN public.influencers.wrong_username_handles IS
  'Snapshot of {platform, handle} pairs (normalized handle) that triggered the wrong-username hold.';

CREATE INDEX IF NOT EXISTS idx_influencers_wrong_username_held_at
  ON public.influencers (wrong_username_held_at)
  WHERE wrong_username_held_at IS NOT NULL;