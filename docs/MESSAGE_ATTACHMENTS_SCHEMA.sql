-- Message attachments (run in Supabase SQL Editor)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- Allow attachment-only messages (empty caption)
ALTER TABLE messages ALTER COLUMN content DROP NOT NULL;
ALTER TABLE messages ALTER COLUMN content SET DEFAULT '';

-- Storage bucket: create "message-attachments" in Dashboard (public or with signed URLs).
-- Suggested: public read; authenticated/service upload under conversations/{id}/…
-- Fallback: code also uploads under avatars/message-attachments/ if bucket missing.
