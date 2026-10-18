-- Campaign workflow additions. Run once in the Supabase SQL editor.
-- Safe to re-run. Does not delete rows.
--
-- 1. Extra campaign fields (platforms, min followers, area, start date, compensation).
-- 2. Application fields (proposed price, past-work links) and status "accepted".
-- 3. Unverified brands may save drafts. Only verified brands may set status = open.

ALTER TABLE brand_campaigns
  ADD COLUMN IF NOT EXISTS platforms TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS min_followers INTEGER,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS starts_on DATE,
  ADD COLUMN IF NOT EXISTS compensation_type TEXT;

ALTER TABLE brand_campaigns DROP CONSTRAINT IF EXISTS brand_campaigns_compensation_type_check;
ALTER TABLE brand_campaigns
  ADD CONSTRAINT brand_campaigns_compensation_type_check
  CHECK (compensation_type IS NULL OR compensation_type IN ('money', 'product', 'both'));

ALTER TABLE campaign_applications
  ADD COLUMN IF NOT EXISTS proposed_price NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS work_links TEXT;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'campaign_applications'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.campaign_applications DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE campaign_applications
  ADD CONSTRAINT campaign_applications_status_check
  CHECK (status IN ('pending', 'withdrawn', 'shortlisted', 'rejected', 'accepted'));

-- Drafts: any brand owner. Open: verified brand only.
DROP POLICY IF EXISTS "brand_campaigns_insert" ON brand_campaigns;
CREATE POLICY "brand_campaigns_insert" ON brand_campaigns
  FOR INSERT
  WITH CHECK (
    brand_id = auth.uid()
    AND (
      status IS DISTINCT FROM 'open'
      OR EXISTS (
        SELECT 1 FROM brands b
        WHERE b.id = auth.uid() AND COALESCE(b.verified, false) = true
      )
    )
  );

DROP POLICY IF EXISTS "brand_campaigns_update" ON brand_campaigns;
CREATE POLICY "brand_campaigns_update" ON brand_campaigns
  FOR UPDATE
  USING (brand_id = auth.uid())
  WITH CHECK (
    brand_id = auth.uid()
    AND (
      status IS DISTINCT FROM 'open'
      OR EXISTS (
        SELECT 1 FROM brands b
        WHERE b.id = auth.uid() AND COALESCE(b.verified, false) = true
      )
    )
  );
