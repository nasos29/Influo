-- Separate approval from analytics verification for influencers
-- Run this SQL in Supabase

-- Add approved field (separate from verified)
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT FALSE;

-- Rename existing verified to analytics_verified (for analytics/insights verification)
-- If verified exists, we'll keep it as is and add analytics_verified
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS analytics_verified BOOLEAN DEFAULT FALSE;

-- If you want to migrate existing verified to analytics_verified:
-- UPDATE influencers SET analytics_verified = verified WHERE verified = true;

-- Optional: Add timestamps for tracking
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS analytics_verified_at TIMESTAMPTZ;

-- Optional: Add notes
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS approval_notes TEXT;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS analytics_verification_notes TEXT;

