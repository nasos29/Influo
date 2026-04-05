-- Run in Supabase SQL Editor if influencers don't see open campaigns (e.g. test brand not verified).
-- Open campaigns: logged-in users see all; anonymous users only see campaigns from verified brands.

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

-- Align applications: allow apply to any open campaign (influencer must still be approved in policy below)
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
