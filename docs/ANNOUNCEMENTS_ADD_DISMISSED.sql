-- Add dismissed_at to announcement_reads so influencers can hide announcements from their list.
-- Run in Supabase SQL Editor after ANNOUNCEMENTS_SCHEMA.sql.

ALTER TABLE announcement_reads
  ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;

COMMENT ON COLUMN announcement_reads.dismissed_at IS 'When the influencer dismissed (hid) this announcement from their list.';
