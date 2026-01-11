# Influencer Analytics System - Database Schema

## SQL Setup

```sql
-- Create influencer_analytics table to track all events
CREATE TABLE IF NOT EXISTS influencer_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('profile_view', 'profile_click', 'proposal_sent', 'message_sent', 'conversation_started')),
  brand_email TEXT, -- Optional: if event is from a brand
  brand_name TEXT, -- Optional: if event is from a brand
  metadata JSONB DEFAULT '{}'::JSONB, -- Additional data (e.g., proposal_id, message_id, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_analytics_influencer ON influencer_analytics(influencer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON influencer_analytics(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON influencer_analytics(created_at DESC);

-- Enable RLS
ALTER TABLE influencer_analytics ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role to insert (for API routes)
CREATE POLICY "Service role can insert analytics" ON influencer_analytics
  FOR INSERT WITH CHECK (true);

-- Policy: Allow service role to select (for API routes)
CREATE POLICY "Service role can select analytics" ON influencer_analytics
  FOR SELECT USING (true);
```

## Event Types

- `profile_view`: When someone views an influencer's profile page
- `profile_click`: When someone clicks "View Profile" from directory/dashboard
- `proposal_sent`: When a brand sends a proposal to an influencer
- `message_sent`: When a brand sends a message to an influencer
- `conversation_started`: When a new conversation is created

## Metadata Structure

```json
{
  "proposal_id": 123,  // For proposal_sent events
  "message_id": "uuid",  // For message_sent events
  "conversation_id": "uuid",  // For conversation_started events
  "source": "directory" | "dashboard" | "recommendation"  // Where the click/view came from
}
```
