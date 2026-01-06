-- Add file attachments support to support_tickets table
-- Run this SQL in Supabase

-- Add attachments column (JSON array of file URLs)
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::JSONB;

-- Example structure for attachments:
-- [
--   {
--     "url": "https://supabase.co/storage/...",
--     "filename": "document.pdf",
--     "size": 123456,
--     "content_type": "application/pdf",
--     "uploaded_at": "2024-01-01T00:00:00Z"
--   }
-- ]

-- Create storage bucket for ticket attachments (run this in Supabase Storage)
-- CREATE BUCKET IF NOT EXISTS ticket-attachments;
-- ALTER BUCKET ticket-attachments SET PUBLIC false;

-- Add RLS policy for ticket attachments (if needed)
-- CREATE POLICY "Users can upload their own ticket attachments" ON storage.objects
--   FOR INSERT WITH CHECK (
--     bucket_id = 'ticket-attachments' AND
--     auth.uid()::text = (storage.foldername(name))[1]
--   );

