-- Brand campaigns + influencer applications (run in Supabase SQL Editor)
-- Brands publish campaigns (title, description, budget, etc.); influencers apply.

CREATE TABLE IF NOT EXISTS brand_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  budget NUMERIC(12, 2) NOT NULL DEFAULT 0,
  category TEXT,
  deliverables TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed')),
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_campaigns_brand_id ON brand_campaigns(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_campaigns_status ON brand_campaigns(status);

CREATE TABLE IF NOT EXISTS campaign_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES brand_campaigns(id) ON DELETE CASCADE,
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'withdrawn', 'shortlisted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, influencer_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_applications_campaign ON campaign_applications(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_applications_influencer ON campaign_applications(influencer_id);

ALTER TABLE brand_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_applications ENABLE ROW LEVEL SECURITY;

-- brand_campaigns: anon sees open+verified only; logged-in users see all open; owner sees own (any status)
DROP POLICY IF EXISTS "brand_campaigns_select" ON brand_campaigns;
CREATE POLICY "brand_campaigns_select" ON brand_campaigns
  FOR SELECT
  USING (
    (
      status = 'open'
      AND (
        auth.uid() IS NOT NULL
        OR EXISTS (
          SELECT 1 FROM brands b
          WHERE b.id = brand_campaigns.brand_id AND COALESCE(b.verified, false) = true
        )
      )
    )
    OR (auth.uid() IS NOT NULL AND brand_id = auth.uid())
  );

DROP POLICY IF EXISTS "brand_campaigns_insert" ON brand_campaigns;
CREATE POLICY "brand_campaigns_insert" ON brand_campaigns
  FOR INSERT
  WITH CHECK (brand_id = auth.uid());

DROP POLICY IF EXISTS "brand_campaigns_update" ON brand_campaigns;
CREATE POLICY "brand_campaigns_update" ON brand_campaigns
  FOR UPDATE
  USING (brand_id = auth.uid())
  WITH CHECK (brand_id = auth.uid());

DROP POLICY IF EXISTS "brand_campaigns_delete" ON brand_campaigns;
CREATE POLICY "brand_campaigns_delete" ON brand_campaigns
  FOR DELETE
  USING (brand_id = auth.uid());

-- campaign_applications
DROP POLICY IF EXISTS "campaign_apps_select" ON campaign_applications;
CREATE POLICY "campaign_apps_select" ON campaign_applications
  FOR SELECT
  USING (
    influencer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM brand_campaigns bc
      WHERE bc.id = campaign_applications.campaign_id AND bc.brand_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "campaign_apps_insert" ON campaign_applications;
CREATE POLICY "campaign_apps_insert" ON campaign_applications
  FOR INSERT
  WITH CHECK (
    influencer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM influencers i
      WHERE i.id = auth.uid() AND COALESCE(i.approved, false) = true
    )
    AND EXISTS (
      SELECT 1 FROM brand_campaigns c
      WHERE c.id = campaign_applications.campaign_id AND c.status = 'open'
    )
  );

DROP POLICY IF EXISTS "campaign_apps_update_influencer" ON campaign_applications;
CREATE POLICY "campaign_apps_update_influencer" ON campaign_applications
  FOR UPDATE
  USING (influencer_id = auth.uid())
  WITH CHECK (influencer_id = auth.uid());

DROP POLICY IF EXISTS "campaign_apps_update_brand" ON campaign_applications;
CREATE POLICY "campaign_apps_update_brand" ON campaign_applications
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM brand_campaigns bc
      WHERE bc.id = campaign_applications.campaign_id AND bc.brand_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM brand_campaigns bc
      WHERE bc.id = campaign_applications.campaign_id AND bc.brand_id = auth.uid()
    )
  );

COMMENT ON TABLE brand_campaigns IS 'Brand-published collaboration briefs (campaigns).';
COMMENT ON TABLE campaign_applications IS 'Influencer interest / applications to brand campaigns.';
