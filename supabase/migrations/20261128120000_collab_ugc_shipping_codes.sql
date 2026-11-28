-- UGC draft deliverables, product shipping, tracking fields, campaign creator filters (additive).

-- 1) Collab deliverable uploads (reuse creator_media_uploads worker; no portfolio append).
ALTER TABLE public.creator_media_uploads
  DROP CONSTRAINT IF EXISTS creator_media_uploads_purpose_check;

ALTER TABLE public.creator_media_uploads
  ADD CONSTRAINT creator_media_uploads_purpose_check
  CHECK (purpose IS NULL OR purpose IN ('homepage_showcase', 'collab_deliverable'));

COMMENT ON COLUMN public.creator_media_uploads.purpose IS
  'homepage_showcase / collab_deliverable: encode to creator-videos, do not append influencers.videos.';

ALTER TABLE public.creator_media_uploads
  ADD COLUMN IF NOT EXISTS collab_proposal_id bigint NULL,
  ADD COLUMN IF NOT EXISTS collab_application_id uuid NULL;

COMMENT ON COLUMN public.creator_media_uploads.collab_proposal_id IS
  'When purpose=collab_deliverable: owning direct proposal (server API auth only).';
COMMENT ON COLUMN public.creator_media_uploads.collab_application_id IS
  'When purpose=collab_deliverable: owning campaign application (server API auth only).';

CREATE INDEX IF NOT EXISTS creator_media_uploads_collab_proposal_idx
  ON public.creator_media_uploads (collab_proposal_id)
  WHERE collab_proposal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS creator_media_uploads_collab_application_idx
  ON public.creator_media_uploads (collab_application_id)
  WHERE collab_application_id IS NOT NULL;

-- 2) Draft workflow columns (proposals + campaign applications).
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS deliverable_draft_upload_id uuid NULL,
  ADD COLUMN IF NOT EXISTS deliverable_draft_status text NULL,
  ADD COLUMN IF NOT EXISTS deliverable_draft_review_note text NULL,
  ADD COLUMN IF NOT EXISTS deliverable_draft_revision_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.campaign_applications
  ADD COLUMN IF NOT EXISTS deliverable_draft_upload_id uuid NULL,
  ADD COLUMN IF NOT EXISTS deliverable_draft_status text NULL,
  ADD COLUMN IF NOT EXISTS deliverable_draft_review_note text NULL,
  ADD COLUMN IF NOT EXISTS deliverable_draft_revision_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.proposals DROP CONSTRAINT IF EXISTS proposals_deliverable_draft_status_check;
ALTER TABLE public.proposals
  ADD CONSTRAINT proposals_deliverable_draft_status_check
  CHECK (
    deliverable_draft_status IS NULL
    OR deliverable_draft_status IN ('submitted', 'changes_requested', 'approved')
  );

ALTER TABLE public.campaign_applications DROP CONSTRAINT IF EXISTS campaign_applications_deliverable_draft_status_check;
ALTER TABLE public.campaign_applications
  ADD CONSTRAINT campaign_applications_deliverable_draft_status_check
  CHECK (
    deliverable_draft_status IS NULL
    OR deliverable_draft_status IN ('submitted', 'changes_requested', 'approved')
  );

COMMENT ON COLUMN public.proposals.deliverable_draft_upload_id IS
  'Latest UGC draft media upload id (unreleased; download via authenticated API only).';
COMMENT ON COLUMN public.campaign_applications.deliverable_draft_upload_id IS
  'Latest UGC draft media upload id (unreleased; download via authenticated API only).';

-- 3) Brand tracking / promo fields (two-party only; service APIs).
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS collab_promo_code text NULL,
  ADD COLUMN IF NOT EXISTS collab_utm_link text NULL,
  ADD COLUMN IF NOT EXISTS collab_spark_ads_code text NULL;

ALTER TABLE public.campaign_applications
  ADD COLUMN IF NOT EXISTS collab_promo_code text NULL,
  ADD COLUMN IF NOT EXISTS collab_utm_link text NULL,
  ADD COLUMN IF NOT EXISTS collab_spark_ads_code text NULL;

-- 4) Product shipping (campaign applications on product/both campaigns).
CREATE TABLE IF NOT EXISTS public.collaboration_shipping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL UNIQUE REFERENCES public.campaign_applications(id) ON DELETE CASCADE,
  recipient_name text NULL,
  phone text NULL,
  street text NULL,
  city text NULL,
  postal_code text NULL,
  country text NOT NULL DEFAULT 'GR',
  notes text NULL,
  status text NOT NULL DEFAULT 'pending_address'
    CHECK (status IN ('pending_address', 'address_submitted', 'shipped', 'received')),
  courier text NULL,
  tracking_number text NULL,
  tracking_url text NULL,
  address_submitted_at timestamptz NULL,
  shipped_at timestamptz NULL,
  received_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.collaboration_shipping IS
  'Product shipment for accepted campaign applications. No direct client access; server APIs enforce brand/creator parties.';
CREATE INDEX IF NOT EXISTS collaboration_shipping_status_idx
  ON public.collaboration_shipping (status, updated_at DESC);

ALTER TABLE public.collaboration_shipping ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.collaboration_shipping FROM PUBLIC, anon, authenticated;

-- 5) Campaign creator requirements (gender + engagement rate range).
ALTER TABLE public.brand_campaigns
  ADD COLUMN IF NOT EXISTS required_gender text NULL,
  ADD COLUMN IF NOT EXISTS min_engagement_rate numeric(6,3) NULL,
  ADD COLUMN IF NOT EXISTS max_engagement_rate numeric(6,3) NULL;

ALTER TABLE public.brand_campaigns DROP CONSTRAINT IF EXISTS brand_campaigns_required_gender_check;
ALTER TABLE public.brand_campaigns
  ADD CONSTRAINT brand_campaigns_required_gender_check
  CHECK (required_gender IS NULL OR required_gender IN ('Female', 'Male', 'AI'));

COMMENT ON COLUMN public.brand_campaigns.required_gender IS
  'Optional creator gender requirement (matches directory values).';
COMMENT ON COLUMN public.brand_campaigns.min_engagement_rate IS
  'Optional minimum engagement rate % for applicants.';
COMMENT ON COLUMN public.brand_campaigns.max_engagement_rate IS
  'Optional maximum engagement rate % for applicants.';

GRANT SELECT (required_gender, min_engagement_rate, max_engagement_rate) ON TABLE public.brand_campaigns TO anon, authenticated;