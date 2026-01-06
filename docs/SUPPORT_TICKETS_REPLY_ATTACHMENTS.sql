-- Add admin_reply_attachments column to support_tickets table
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS admin_reply_attachments JSONB DEFAULT '[]'::JSONB;

-- Index for faster queries (optional)
CREATE INDEX IF NOT EXISTS idx_support_tickets_admin_reply_attachments ON support_tickets USING GIN (admin_reply_attachments);

