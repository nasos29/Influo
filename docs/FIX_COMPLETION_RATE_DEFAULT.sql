-- Fix influencers.completion_rate default of 100 that made every profile
-- show "Completion Rate 100%" with no collaborations.
-- Run in Supabase SQL Editor. Do not re-run casually after real rates exist.

ALTER TABLE influencers ALTER COLUMN completion_rate DROP DEFAULT;

UPDATE influencers
SET completion_rate = NULL
WHERE id NOT IN (
  SELECT DISTINCT influencer_id
  FROM proposals
  WHERE influencer_id IS NOT NULL
);

COMMENT ON COLUMN influencers.completion_rate IS
  'Share of terminal proposals that are completed (0–100). Numerator = status completed only; denominator = completed/rejected/cancelled/declined. NULL when there is no terminal proposal yet.';
