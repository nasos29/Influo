-- GAP 5: brand request-changes on direct proposal deliverables (additive; do not backfill).
BEGIN;

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS deliverable_status text,
  ADD COLUMN IF NOT EXISTS deliverable_review_note text;

COMMENT ON COLUMN public.proposals.deliverable_status IS
  'Deliverable review state for direct proposals: none, submitted, changes_requested, approved.';
COMMENT ON COLUMN public.proposals.deliverable_review_note IS
  'Brand comment when deliverable_status is changes_requested.';

ALTER TABLE public.proposals
  DROP CONSTRAINT IF EXISTS proposals_deliverable_status_check;

ALTER TABLE public.proposals
  ADD CONSTRAINT proposals_deliverable_status_check
  CHECK (
    deliverable_status IS NULL
    OR deliverable_status IN ('none', 'submitted', 'changes_requested', 'approved')
  );

COMMIT;