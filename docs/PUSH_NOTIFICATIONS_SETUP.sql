-- Push Notifications: Table for storing Web Push subscriptions
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_type TEXT NOT NULL CHECK (user_type IN ('influencer', 'brand')),
  user_identifier TEXT NOT NULL,  -- influencer id (UUID) or brand_email
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user 
  ON push_subscriptions(user_type, user_identifier);

COMMENT ON TABLE push_subscriptions IS 'Web Push: influencers (id), brands (email). Admin uses brand row with email = ADMIN_EMAIL env — must match logged-in admin email for subscriptions.';
