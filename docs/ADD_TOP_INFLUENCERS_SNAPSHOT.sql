-- Snapshot of homepage Top 10 IDs for congrats email/push (newcomers only).
-- Run once in Supabase SQL editor.

CREATE TABLE IF NOT EXISTS top_influencers_snapshot (
  id TEXT PRIMARY KEY DEFAULT 'global',
  influencer_ids TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE top_influencers_snapshot ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies: only service_role (cron/API) can access.

COMMENT ON TABLE top_influencers_snapshot IS
  'Last known Top 10 influencer ids; cron compares to detect new entries for email/push.';
