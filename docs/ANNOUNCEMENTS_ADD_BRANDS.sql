-- Announcements: also target all brands or a specific brand.
-- Run in Supabase SQL Editor after ANNOUNCEMENTS_SCHEMA.sql (and ANNOUNCEMENTS_ADD_DISMISSED.sql if used).
-- Do not run automatically from the app.

-- Allow brand audience values on announcements.target_type
ALTER TABLE announcements
  DROP CONSTRAINT IF EXISTS announcements_target_type_check;

ALTER TABLE announcements
  ADD CONSTRAINT announcements_target_type_check
  CHECK (target_type IN ('all', 'specific', 'all_brands', 'specific_brand'));

ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS target_brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_announcements_target_brand
  ON announcements(target_type, target_brand_id);

COMMENT ON COLUMN announcements.target_brand_id IS
  'Brand recipient when target_type = specific_brand (brands.id).';

-- Separate read/dismiss tracking for brands (keeps influencer_id rows untouched).
CREATE TABLE IF NOT EXISTS announcement_brand_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dismissed_at TIMESTAMPTZ,
  UNIQUE (announcement_id, brand_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_brand_reads_brand
  ON announcement_brand_reads(brand_id);

CREATE INDEX IF NOT EXISTS idx_announcement_brand_reads_announcement
  ON announcement_brand_reads(announcement_id);

ALTER TABLE announcement_brand_reads ENABLE ROW LEVEL SECURITY;

-- Brands read their own rows via auth.uid() = brands.id (common signup path).
-- Brand dashboard APIs use the service role; these policies are a safety net.
CREATE POLICY "Brands can manage own announcement reads"
  ON announcement_brand_reads FOR ALL
  USING (brand_id = auth.uid())
  WITH CHECK (brand_id = auth.uid());

-- Brands can SELECT announcements aimed at all brands or their brand id.
CREATE POLICY "Brands can read relevant announcements"
  ON announcements FOR SELECT
  USING (
    target_type = 'all_brands'
    OR target_brand_id = auth.uid()
  );

COMMENT ON TABLE announcement_brand_reads IS
  'Tracks which brand read/dismissed which announcement.';
