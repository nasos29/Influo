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
ALTER TABLE IF EXISTS profile_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_roles ENABLE ROW LEVEL SECURITY;

-- 3) Influencers table: RLS policies
ALTER TABLE IF EXISTS influencers ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view influencers (public profiles)
CREATE POLICY "Influencers are viewable by everyone"
ON public.influencers
FOR SELECT
USING (true);

-- Allow influencers to update their own profile
CREATE POLICY "Influencers can update their own profile"
ON public.influencers
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 4) Influencer reviews table: RLS policies
ALTER TABLE IF EXISTS influencer_reviews ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view reviews
CREATE POLICY "Influencer reviews are viewable by everyone"
ON public.influencer_reviews
FOR SELECT
USING (true);

-- Allow authenticated users to insert reviews
CREATE POLICY "Authenticated users can insert reviews"
ON public.influencer_reviews
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- 5) Proposals table: RLS policies
ALTER TABLE IF EXISTS proposals ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view proposals (public)
CREATE POLICY "Proposals are viewable by everyone"
ON public.proposals
FOR SELECT
USING (true);

-- Allow authenticated users to insert proposals
CREATE POLICY "Authenticated users can insert proposals"
ON public.proposals
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Allow proposal creators to update/delete their own proposals
CREATE POLICY "Proposal creators can update/delete their own proposals"
ON public.proposals
FOR ALL
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

-- 6) Re-check after fix (should return 0 rows for fixed tables):
SELECT c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND NOT c.relrowsecurity
ORDER BY c.relname;
