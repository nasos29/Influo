-- Deliverable warning (day 10) + auto-cancel (3 Athens days after warning).
-- Feature gated by DELIVERABLE_AUTOCANCEL_ENABLED (default off in app).

-- Example backup (run manually before large backfills; not executed here):
-- CREATE TABLE IF NOT EXISTS public._backup_proposals_autocancel_20261121 AS
--   SELECT * FROM public.proposals WHERE false;

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS deliverable_warning_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS restored_at timestamptz;

ALTER TABLE public.campaign_applications
  ADD COLUMN IF NOT EXISTS deliverable_warning_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS restored_at timestamptz;

COMMENT ON COLUMN public.proposals.deliverable_warning_sent_at IS
  'When creator was warned: submit deliverable or cancel within 3 Athens calendar days.';
COMMENT ON COLUMN public.proposals.auto_cancelled_at IS
  'When cron auto-cancelled for missing deliverable (cancelled_by=system).';
COMMENT ON COLUMN public.proposals.restored_at IS
  'Admin restore after auto-cancel; resets 10/13 deliverable autocancel clock.';

COMMENT ON COLUMN public.campaign_applications.deliverable_warning_sent_at IS
  'When creator was warned: submit deliverable or cancel within 3 Athens calendar days.';
COMMENT ON COLUMN public.campaign_applications.auto_cancelled_at IS
  'When cron auto-cancelled for missing deliverable (cancelled_by=system).';
COMMENT ON COLUMN public.campaign_applications.restored_at IS
  'Admin restore after auto-cancel; resets 10/13 deliverable autocancel clock.';

ALTER TABLE public.proposals
  DROP CONSTRAINT IF EXISTS proposals_cancelled_by_check;
ALTER TABLE public.proposals
  ADD CONSTRAINT proposals_cancelled_by_check
  CHECK (cancelled_by IS NULL OR cancelled_by IN ('brand', 'influencer', 'admin', 'system'));

ALTER TABLE public.campaign_applications
  DROP CONSTRAINT IF EXISTS campaign_applications_cancelled_by_check;
ALTER TABLE public.campaign_applications
  ADD CONSTRAINT campaign_applications_cancelled_by_check
  CHECK (cancelled_by IS NULL OR cancelled_by IN ('brand', 'influencer', 'admin', 'system'));