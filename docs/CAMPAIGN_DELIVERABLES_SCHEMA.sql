-- Campaign deliverable workflow (run in Supabase SQL Editor)
ALTER TABLE campaign_applications
  ADD COLUMN IF NOT EXISTS deliverable_url TEXT,
  ADD COLUMN IF NOT EXISTS deliverable_note TEXT,
  ADD COLUMN IF NOT EXISTS deliverable_status TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS deliverable_review_note TEXT,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- deliverable_status: none | submitted | approved | changes_requested
COMMENT ON COLUMN campaign_applications.deliverable_status IS
  'none | submitted | approved | changes_requested';
