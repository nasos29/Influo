-- Profile Changes Tracking Schema
-- This table stores the old values when an influencer edits their profile
-- Run this SQL in Supabase

-- Create profile_changes table
CREATE TABLE IF NOT EXISTS profile_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  old_values JSONB NOT NULL, -- Stores the old values before the change
  new_values JSONB NOT NULL, -- Stores the new values after the change
  changed_fields TEXT[] NOT NULL, -- Array of field names that changed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by_admin BOOLEAN DEFAULT FALSE, -- True when admin has reviewed these changes
  reviewed_at TIMESTAMPTZ
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_profile_changes_influencer ON profile_changes(influencer_id);
CREATE INDEX IF NOT EXISTS idx_profile_changes_created ON profile_changes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_changes_reviewed ON profile_changes(reviewed_by_admin, influencer_id) WHERE reviewed_by_admin = FALSE;

-- Enable RLS
ALTER TABLE profile_changes ENABLE ROW LEVEL SECURITY;

-- Policy: Allow admins to read all changes, influencers to read their own
CREATE POLICY "Allow admins to read all profile changes" ON profile_changes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM influencers 
      WHERE influencers.id = profile_changes.influencer_id
    )
  );

-- Policy: Allow system to insert changes (via service role)
CREATE POLICY "Allow insert profile changes" ON profile_changes
  FOR INSERT WITH CHECK (true);

-- Policy: Allow admins to update review status
CREATE POLICY "Allow update review status" ON profile_changes
  FOR UPDATE USING (true);
