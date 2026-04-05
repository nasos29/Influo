-- Apply in Supabase SQL Editor to enforce:
-- - Only verified brands can INSERT/UPDATE campaigns (DELETE own rows still allowed).
-- - Open campaigns: visible to anon only if brand verified; to logged-in approved influencers
--   or any brand; NOT visible to unapproved influencers.
-- - Applications: approved influencer + open campaign + verified brand.

DROP POLICY IF EXISTS "brand_campaigns_select" ON brand_campaigns;
CREATE POLICY "brand_campaigns_select" ON brand_campaigns
  FOR SELECT
  USING (
    (auth.uid() IS NOT NULL AND brand_id = auth.uid())
    OR (
      status = 'open'
      AND EXISTS (
        SELECT 1 FROM brands b
        WHERE b.id = brand_campaigns.brand_id AND COALESCE(b.verified, false) = true
      )
      AND (
        auth.uid() IS NULL
        OR EXISTS (
          SELECT 1 FROM influencers i
          WHERE i.id = auth.uid() AND COALESCE(i.approved, false) = true
        )
        OR EXISTS (SELECT 1 FROM brands b2 WHERE b2.id = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "brand_campaigns_insert" ON brand_campaigns;
CREATE POLICY "brand_campaigns_insert" ON brand_campaigns
  FOR INSERT
  WITH CHECK (
    brand_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM brands b WHERE b.id = auth.uid() AND COALESCE(b.verified, false) = true
    )
  );

DROP POLICY IF EXISTS "brand_campaigns_update" ON brand_campaigns;
CREATE POLICY "brand_campaigns_update" ON brand_campaigns
  FOR UPDATE
  USING (brand_id = auth.uid())
  WITH CHECK (
    brand_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM brands b WHERE b.id = auth.uid() AND COALESCE(b.verified, false) = true
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
      INNER JOIN brands b ON b.id = c.brand_id
      WHERE c.id = campaign_applications.campaign_id
        AND c.status = 'open'
        AND COALESCE(b.verified, false) = true
    )
  );
