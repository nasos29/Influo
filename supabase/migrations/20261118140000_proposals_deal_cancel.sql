-- Deal cancel metadata on proposals (started collaboration cancelled before real delivery complete).
-- Do NOT apply to prod from the agent — ship in the PR for ops.

BEGIN;
SET LOCAL lock_timeout = '15s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS cancelled_by text,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'proposals_cancelled_by_check'
      AND conrelid = 'public.proposals'::regclass
  ) THEN
    ALTER TABLE public.proposals
      ADD CONSTRAINT proposals_cancelled_by_check
      CHECK (cancelled_by IS NULL OR cancelled_by IN ('brand', 'influencer', 'admin'));
  END IF;
END $$;

COMMENT ON COLUMN public.proposals.cancelled_by IS 'Who cancelled an in-flight deal: brand, influencer, or admin';
COMMENT ON COLUMN public.proposals.cancel_reason IS 'Mandatory free-text reason when status=cancelled';
COMMENT ON COLUMN public.proposals.cancelled_at IS 'When the deal was cancelled';

COMMIT;