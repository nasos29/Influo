-- Additive: lock influencers out of cron auto-approval after admin manual un-approve.
-- Do NOT apply to production from this PR alone without the usual deploy path.
-- Backup first; RLS on backup; new columns only (no data rewrite).

-- 1) Snapshot of approval-related columns before schema change.
CREATE TABLE IF NOT EXISTS public.backup_influencers_manual_unapprove_20261116 AS
SELECT
  id,
  display_name,
  contact_email,
  approved,
  approved_at,
  analytics_verified,
  analytics_verified_at,
  now() AS backed_up_at
FROM public.influencers;

ALTER TABLE public.backup_influencers_manual_unapprove_20261116 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.backup_influencers_manual_unapprove_20261116 FROM PUBLIC, anon, authenticated;

-- 2) Lock columns: set on admin un-approve; cleared only on admin manual approve.
ALTER TABLE public.influencers
  ADD COLUMN IF NOT EXISTS manual_unapproved_at TIMESTAMPTZ;

ALTER TABLE public.influencers
  ADD COLUMN IF NOT EXISTS manual_unapproved_by UUID;

COMMENT ON COLUMN public.influencers.manual_unapproved_at IS
  'When set, cron/auto-approval must never re-approve. Cleared only by admin manual approve.';

COMMENT ON COLUMN public.influencers.manual_unapproved_by IS
  'Auth user id of the admin who last manually un-approved this influencer.';

CREATE INDEX IF NOT EXISTS idx_influencers_manual_unapproved_at
  ON public.influencers (manual_unapproved_at)
  WHERE manual_unapproved_at IS NOT NULL;

-- NOTE: influencers uses column-level SELECT for anon/authenticated.
-- Do NOT grant these admin-only lock columns to anon/authenticated.
-- Admin list/update uses service_role.

-- Optional backfill (DO NOT run automatically — propose only in handoff report):
-- UPDATE public.influencers i
-- SET
--   manual_unapproved_at = c.unapproved_at,
--   manual_unapproved_by = NULL
-- FROM (
--   ... candidates from profile_changes where admin unapproved and still unapproved ...
-- ) c
-- WHERE i.id = c.influencer_id
--   AND i.manual_unapproved_at IS NULL
--   AND COALESCE(i.approved, false) = false;
