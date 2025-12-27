# Messaging System Database Schema

## Tables Required in Supabase

### 1. `conversations` table

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  influencer_name TEXT NOT NULL,
  influencer_email TEXT NOT NULL,
  brand_email TEXT NOT NULL,
  brand_name TEXT,
  proposal_id BIGINT REFERENCES proposals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(influencer_id, brand_email)
);

-- Index for faster queries
CREATE INDEX idx_conversations_influencer ON conversations(influencer_id);
CREATE INDEX idx_conversations_brand ON conversations(brand_email);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);
```

### 2. `messages` table

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL, -- Can be influencer_id (UUID) or brand_email (TEXT)
  sender_type TEXT NOT NULL CHECK (sender_type IN ('influencer', 'brand')),
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  sent_via_email BOOLEAN DEFAULT FALSE, -- True if sent via email because influencer was offline
  email_sent BOOLEAN DEFAULT FALSE, -- True if included in digest email
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(id)
);
```

### 2.5. `influencer_presence` table (for online/offline status)

```sql
CREATE TABLE influencer_presence (
  influencer_id UUID PRIMARY KEY REFERENCES influencers(id) ON DELETE CASCADE,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  is_online BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_presence_last_seen ON influencer_presence(last_seen);
```

-- Indexes
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
CREATE INDEX idx_messages_unread ON messages(conversation_id, read) WHERE read = FALSE;
CREATE INDEX idx_messages_email_sent ON messages(conversation_id, email_sent, created_at) WHERE email_sent = FALSE;
```

### 3. Enable Row Level Security (RLS)

```sql
-- Enable RLS on conversations
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Enable RLS on messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust based on your auth setup)
-- For now, allow all reads/writes (you can restrict later)
CREATE POLICY "Allow all for authenticated users" ON conversations
  FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated users" ON messages
  FOR ALL USING (true);
```

### 4. Enable Realtime (Optional - for real-time messaging)

```sql
-- Enable realtime on conversations
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;

-- Enable realtime on messages
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
```

## Notes

- `sender_id` can be either a UUID (for influencers) or an email string (for brands)
- `sender_type` ensures we know which type of sender it is
- All messages are sent to admin via email notification
- Conversations are unique per influencer-brand pair
- Messages cascade delete when conversation is deleted

