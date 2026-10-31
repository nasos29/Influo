-- NOT APPLIED. Needs approval before anyone runs this in Supabase.
-- Brand invite from a creator profile (/in/[slug]).
-- Safe to re-run. Does not delete or rewrite existing rows.
--
-- Without this column the profile invite still works: it sends the existing
-- collaboration proposal (message, push, the same notification path as the
-- dashboard "Πρόσκληση"). It does not insert a campaign_applications row,
-- so a brand invite is not mistaken for a creator application.
-- After this column exists, the invite API also stores the row with
-- initiated_by = 'brand'.

ALTER TABLE campaign_applications
  ADD COLUMN IF NOT EXISTS initiated_by TEXT NOT NULL DEFAULT 'influencer';

ALTER TABLE campaign_applications DROP CONSTRAINT IF EXISTS campaign_applications_initiated_by_check;
ALTER TABLE campaign_applications
  ADD CONSTRAINT campaign_applications_initiated_by_check
  CHECK (initiated_by IN ('influencer', 'brand'));

COMMENT ON COLUMN campaign_applications.initiated_by IS
  'influencer = the creator applied. brand = the brand invited them from the creator profile. Default influencer.';
