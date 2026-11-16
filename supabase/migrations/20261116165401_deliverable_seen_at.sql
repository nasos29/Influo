-- Additive: brand first-view receipt for campaign deliverables.
-- Do NOT apply to production from this PR alone without the usual deploy path.
-- Backup first; RLS on backup; new column only (no data rewrite). No emails.

-- 1) Snapshot of deliverable-related columns before schema change.
CREATE TABLE IF NOT EXISTS public.backup_campaign_applications_deliverable_seen_20261116 AS
SELECT
  id,
  campaign_id,
  influencer_id,
  status,
  deliverable_url,
  deliverable_note,
  deliverable_status,
  deliverable_review_note,
  delivered_at,
  reviewed_at,
  now() AS backed_up_at
FROM public.campaign_applications;

ALTER TABLE public.backup_campaign_applications_deliverable_seen_20261116 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.backup_campaign_applications_deliverable_seen_20261116 FROM PUBLIC, anon, authenticated;

-- 2) First time the owning brand opens/expands a submitted deliverable (server API only).
ALTER TABLE public.campaign_applications
  ADD COLUMN IF NOT EXISTS deliverable_seen_at TIMESTAMPTZ;

COMMENT ON COLUMN public.campaign_applications.deliverable_seen_at IS
  'First time the owning brand opened/expanded this submitted deliverable. Null until then; reset when creator submits a new deliverable URL. Never set by admin.';

CREATE INDEX IF NOT EXISTS idx_campaign_applications_deliverable_seen_at
  ON public.campaign_applications (deliverable_seen_at)
  WHERE deliverable_seen_at IS NOT NULL;

-- campaign_applications uses column-level SELECT for anon/authenticated.
GRANT SELECT (deliverable_seen_at) ON TABLE public.campaign_applications TO anon, authenticated;
