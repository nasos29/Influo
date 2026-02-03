-- Announcements: admin sends announcements to all influencers or to a specific one.
-- Run in Supabase SQL Editor.

-- Table: announcements
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  target_type TEXT NOT NULL CHECK (target_type IN ('all', 'specific')),
  target_influencer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_target ON announcements(target_type, target_influencer_id);

-- Table: announcement_reads (tracks which influencer has read which announcement)
CREATE TABLE IF NOT EXISTS announcement_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  influencer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(announcement_id, influencer_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_reads_influencer ON announcement_reads(influencer_id);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_announcement ON announcement_reads(announcement_id);

-- RLS: announcements visible to admins (service role) and to influencers (for their own / all)
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;

-- Policy: influencers can read announcements targeted to 'all' or to their id
CREATE POLICY "Influencers can read relevant announcements"
  ON announcements FOR SELECT
  USING (
    target_type = 'all'
    OR target_influencer_id = auth.uid()
  );

-- Policy: influencers can read their own reads and insert (mark as read)
CREATE POLICY "Influencers can manage own reads"
  ON announcement_reads FOR ALL
  USING (influencer_id = auth.uid())
  WITH CHECK (influencer_id = auth.uid());

COMMENT ON TABLE announcements IS 'Admin announcements to influencers (all or specific).';
COMMENT ON TABLE announcement_reads IS 'Tracks which influencer read which announcement.';
