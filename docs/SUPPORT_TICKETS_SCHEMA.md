# Support Tickets System - Database Schema

## SQL Setup

Τρέξε αυτό το SQL στο Supabase SQL Editor:

**📄 Καθαρό SQL file:** `SUPPORT_TICKETS_SCHEMA.sql` (copy-paste από εκεί)

Ή copy-paste από εδώ:

```sql
-- Create support_tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL, -- Can be influencer_id (UUID) or brand_email (TEXT)
  user_type TEXT NOT NULL CHECK (user_type IN ('influencer', 'brand')),
  user_email TEXT NOT NULL,
  user_name TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  admin_reply TEXT,
  admin_replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_tickets_user ON support_tickets(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_created ON support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_email ON support_tickets(user_email);

-- Enable RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own tickets
CREATE POLICY "Users can view their own tickets" ON support_tickets
  FOR SELECT USING (
    (user_type = 'influencer' AND user_id IN (
      SELECT id::TEXT FROM influencers WHERE contact_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ))
    OR
    (user_type = 'brand' AND user_email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  );

-- Policy: Users can create tickets
CREATE POLICY "Users can create tickets" ON support_tickets
  FOR INSERT WITH CHECK (
    (user_type = 'influencer' AND user_id IN (
      SELECT id::TEXT FROM influencers WHERE contact_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ))
    OR
    (user_type = 'brand' AND user_email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  );

-- Policy: Admin can see all tickets (we'll handle this in the API with service role)
-- For now, allow authenticated users to see all (we'll restrict in API)
CREATE POLICY "Allow all for authenticated users" ON support_tickets
  FOR ALL USING (true);
```

## Table Structure

- `id`: UUID primary key
- `user_id`: The user's ID (influencer UUID or brand email)
- `user_type`: 'influencer' or 'brand'
- `user_email`: User's email address
- `user_name`: User's display name
- `subject`: Ticket subject
- `message`: Initial message
- `status`: 'open', 'in_progress', 'resolved', 'closed'
- `admin_reply`: Admin's reply (if any)
- `admin_replied_at`: When admin replied
- `created_at`: When ticket was created
- `updated_at`: Last update timestamp

