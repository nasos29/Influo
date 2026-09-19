-- Brand shortlist: saved influencers + private notes
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS brand_shortlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (brand_id, influencer_id)
);

CREATE INDEX IF NOT EXISTS idx_brand_shortlist_brand_id ON brand_shortlist(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_shortlist_influencer_id ON brand_shortlist(influencer_id);

ALTER TABLE brand_shortlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brand_shortlist_select" ON brand_shortlist;
CREATE POLICY "brand_shortlist_select" ON brand_shortlist
  FOR SELECT
  USING (brand_id = auth.uid());

DROP POLICY IF EXISTS "brand_shortlist_insert" ON brand_shortlist;
CREATE POLICY "brand_shortlist_insert" ON brand_shortlist
  FOR INSERT
  WITH CHECK (brand_id = auth.uid());

DROP POLICY IF EXISTS "brand_shortlist_update" ON brand_shortlist;
CREATE POLICY "brand_shortlist_update" ON brand_shortlist
  FOR UPDATE
  USING (brand_id = auth.uid())
  WITH CHECK (brand_id = auth.uid());

DROP POLICY IF EXISTS "brand_shortlist_delete" ON brand_shortlist;
CREATE POLICY "brand_shortlist_delete" ON brand_shortlist
  FOR DELETE
  USING (brand_id = auth.uid());

COMMENT ON TABLE brand_shortlist IS 'Private brand shortlist of influencers with optional notes.';
