-- Track when we first sent "new influencer" emails to brands (so we don't resend on re-approval).
-- Run in Supabase SQL Editor.

ALTER TABLE influencers ADD COLUMN IF NOT EXISTS brands_notified_at TIMESTAMPTZ;

COMMENT ON COLUMN influencers.brands_notified_at IS 'Set when this influencer was included in the weekly brand digest email. Re-approvals do not trigger new emails.';

-- Mark all existing influencers as "already notified" so re-approvals do not send duplicate emails.
UPDATE influencers SET brands_notified_at = now() WHERE brands_notified_at IS NULL;
