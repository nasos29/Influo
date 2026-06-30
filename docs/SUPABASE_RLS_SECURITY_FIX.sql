-- Supabase Security Advisor: "rls_disabled_in_public"
-- Run in Supabase SQL Editor (project: rljegispdrlvoyhnefuv)
--
-- 1) See which tables are exposed (no RLS):
SELECT c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND NOT c.relrowsecurity
ORDER BY c.relname;

-- 2) Backend-only tables: enable RLS, no client policies.
--    (service_role API routes still work; anon/authenticated are blocked)
ALTER TABLE IF EXISTS push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS influencer_follower_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS video_embed_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS video_thumbnail_cache ENABLE ROW LEVEL SECURITY;

-- 3) Campaign tables (if created without policies, run full schema):
--    docs/BRAND_CAMPAIGNS_SCHEMA.sql

-- 4) Re-check after fix (should return 0 rows for fixed tables):
SELECT c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND NOT c.relrowsecurity
ORDER BY c.relname;
