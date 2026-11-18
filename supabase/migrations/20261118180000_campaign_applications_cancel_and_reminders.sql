-- Campaign deal cancel + deliverable/review reminder stamps (NOT applied in this PR).
-- Additive only; no backfill.

ALTER TABLE public.campaign_applications
  ADD COLUMN IF NOT EXISTS cancelled_by text,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS deliverable_reminder_before_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS deliverable_reminder_1d_after_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS deliverable_reminder_5d_after_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS brand_approve_reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_reminder_second_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS brand_review_prompts_declined_at timestamptz,
  ADD COLUMN IF NOT EXISTS influencer_review_prompts_declined_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'campaign_applications_cancelled_by_check'
  ) THEN
    ALTER TABLE public.campaign_applications
      ADD CONSTRAINT campaign_applications_cancelled_by_check
      CHECK (cancelled_by IS NULL OR cancelled_by IN ('brand', 'influencer', 'admin'));
  END IF;
END $$;

COMMENT ON COLUMN public.campaign_applications.cancelled_by IS
  'Who cancelled an accepted campaign deal: brand | influencer | admin.';
COMMENT ON COLUMN public.campaign_applications.cancel_reason IS
  'Mandatory reason when cancelling an accepted campaign deal.';
COMMENT ON COLUMN public.campaign_applications.cancelled_at IS
  'When the accepted campaign deal was cancelled.';
COMMENT ON COLUMN public.campaign_applications.deliverable_reminder_before_sent_at IS
  'Creator deliverable reminder sent before campaign deadline.';
COMMENT ON COLUMN public.campaign_applications.deliverable_reminder_1d_after_sent_at IS
  'Creator deliverable reminder sent 1 day after deadline.';
COMMENT ON COLUMN public.campaign_applications.deliverable_reminder_5d_after_sent_at IS
  'Creator deliverable reminder sent 5 days after deadline.';
COMMENT ON COLUMN public.campaign_applications.brand_approve_reminder_sent_at IS
  'Brand reminder to approve pending campaign deliverable.';
COMMENT ON COLUMN public.campaign_applications.review_reminder_sent_at IS
  'First post-completion review reminder email for campaign deal.';
COMMENT ON COLUMN public.campaign_applications.review_reminder_second_sent_at IS
  'Second (final) review reminder for campaign deal.';
COMMENT ON COLUMN public.campaign_applications.brand_review_prompts_declined_at IS
  'Brand declined in-dashboard review prompts for this campaign deal.';
COMMENT ON COLUMN public.campaign_applications.influencer_review_prompts_declined_at IS
  'Creator declined in-dashboard review prompts for this campaign deal.';