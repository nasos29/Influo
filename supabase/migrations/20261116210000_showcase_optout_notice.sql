-- Showcase opt-out notice + 7-day soft consent for past collaborations.
-- Additive only. Do NOT apply to production from an agent task without review.
-- Backup first; RLS on backup tables; no data rewrite; no emails from this migration.

-- 1) Snapshots before schema change
CREATE TABLE IF NOT EXISTS public.backup_proposals_showcase_notice_20261116 AS
SELECT
  id,
  brand_id,
  influencer_id,
  status,
  brand_showcase_consent,
  influencer_showcase_consent,
  published_post_url,
  showcase_admin_hidden,
  now() AS backed_up_at
FROM public.proposals;

ALTER TABLE public.backup_proposals_showcase_notice_20261116 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.backup_proposals_showcase_notice_20261116 FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.backup_campaign_applications_showcase_notice_20261116 AS
SELECT
  id,
  campaign_id,
  influencer_id,
  status,
  deliverable_status,
  deliverable_url,
  brand_showcase_consent,
  influencer_showcase_consent,
  showcase_admin_hidden,
  now() AS backed_up_at
FROM public.campaign_applications;

ALTER TABLE public.backup_campaign_applications_showcase_notice_20261116 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.backup_campaign_applications_showcase_notice_20261116 FROM PUBLIC, anon, authenticated;

-- 2) Proposals: notice + opt-out tracking
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS showcase_notice_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS showcase_optout_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS brand_showcase_opted_out boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS influencer_showcase_opted_out boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.proposals.showcase_notice_sent_at IS
  'When the 7-day showcase backfill/notice email was sent to both parties.';
COMMENT ON COLUMN public.proposals.showcase_optout_deadline IS
  'After this time, cron may set consent=true for parties that did not opt out.';
COMMENT ON COLUMN public.proposals.brand_showcase_opted_out IS
  'Brand clicked one-click showcase opt-out (or toggled off). Blocks auto-consent.';
COMMENT ON COLUMN public.proposals.influencer_showcase_opted_out IS
  'Influencer clicked one-click showcase opt-out (or toggled off). Blocks auto-consent.';

CREATE INDEX IF NOT EXISTS proposals_showcase_optout_deadline_idx
  ON public.proposals (showcase_optout_deadline)
  WHERE showcase_optout_deadline IS NOT NULL
    AND showcase_notice_sent_at IS NOT NULL;

-- 3) Campaign applications: same columns
ALTER TABLE public.campaign_applications
  ADD COLUMN IF NOT EXISTS showcase_notice_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS showcase_optout_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS brand_showcase_opted_out boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS influencer_showcase_opted_out boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.campaign_applications.showcase_notice_sent_at IS
  'When the 7-day showcase backfill/notice email was sent to both parties.';
COMMENT ON COLUMN public.campaign_applications.showcase_optout_deadline IS
  'After this time, cron may set consent=true for parties that did not opt out.';
COMMENT ON COLUMN public.campaign_applications.brand_showcase_opted_out IS
  'Brand clicked one-click showcase opt-out (or toggled off). Blocks auto-consent.';
COMMENT ON COLUMN public.campaign_applications.influencer_showcase_opted_out IS
  'Influencer clicked one-click showcase opt-out (or toggled off). Blocks auto-consent.';

CREATE INDEX IF NOT EXISTS campaign_applications_showcase_optout_deadline_idx
  ON public.campaign_applications (showcase_optout_deadline)
  WHERE showcase_optout_deadline IS NOT NULL
    AND showcase_notice_sent_at IS NOT NULL;
