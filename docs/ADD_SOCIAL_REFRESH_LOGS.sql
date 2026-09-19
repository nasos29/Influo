-- Social refresh cron logs. Run in Supabase SQL Editor.
-- Rows older than 45 days are deleted by the cron API on each run.

CREATE TABLE IF NOT EXISTS social_refresh_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  influencers_total INTEGER NOT NULL DEFAULT 0,
  influencers_ok INTEGER NOT NULL DEFAULT 0,
  influencers_unapproved INTEGER NOT NULL DEFAULT 0,
  message TEXT
);

CREATE TABLE IF NOT EXISTS social_refresh_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES social_refresh_runs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  level TEXT NOT NULL DEFAULT 'info',
  influencer_id TEXT,
  influencer_name TEXT,
  platform TEXT,
  username TEXT,
  event TEXT NOT NULL,
  message TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_social_refresh_runs_started
  ON social_refresh_runs (started_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_refresh_logs_run
  ON social_refresh_logs (run_id, created_at);

CREATE INDEX IF NOT EXISTS idx_social_refresh_logs_created
  ON social_refresh_logs (created_at DESC);

ALTER TABLE social_refresh_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_refresh_logs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE social_refresh_runs IS 'One row per 15-day Oracle social refresh job.';
COMMENT ON TABLE social_refresh_logs IS 'Per-account / per-event log lines. Auto-purged after 45 days.';
