-- Optional privacy-preserving IP fingerprint for analytics uniqueness.
-- Run in Supabase SQL Editor when ready. Do not store raw IPs.
-- App hashes: sha256(ip + ANALYTICS_IP_SALT) and writes the hex digest here.
-- Ranking: same ip_hash + influencer + event_type counts at most once per calendar day.
-- Code falls back gracefully when this column is missing.

ALTER TABLE influencer_analytics ADD COLUMN IF NOT EXISTS ip_hash TEXT;

COMMENT ON COLUMN influencer_analytics.ip_hash IS
  'SHA-256 hex of client IP + ANALYTICS_IP_SALT. Never store raw IP. Used for unique-per-day anon counting when visitor_id is absent.';

CREATE INDEX IF NOT EXISTS idx_influencer_analytics_ip_hash
  ON influencer_analytics (influencer_id, event_type, ip_hash)
  WHERE ip_hash IS NOT NULL;
