# Online/Offline Status Setup

## Database Schema

Πρέπει να τρέξεις αυτό το SQL στο Supabase:

```sql
-- Create influencer_presence table
CREATE TABLE influencer_presence (
  influencer_id UUID PRIMARY KEY REFERENCES influencers(id) ON DELETE CASCADE,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  is_online BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_presence_last_seen ON influencer_presence(last_seen);

-- Enable RLS
ALTER TABLE influencer_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON influencer_presence
  FOR ALL USING (true);
```

## Επίσης ενημέρωσε το messages table:

```sql
-- Add sent_via_email column
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sent_via_email BOOLEAN DEFAULT FALSE;
```

## Features Implemented:

1. ✅ Auto-create conversation από proposals
2. ✅ Online/Offline status tracking (με 5 λεπτά timeout)
3. ✅ Email fallback όταν ο influencer είναι offline
4. ✅ Admin dashboard - view όλων των συνομιλιών

