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

-- Drop existing policies first
DROP POLICY IF EXISTS "Influencers are viewable by everyone" ON public.influencers;
DROP POLICY IF EXISTS "Users can insert their own influencer profile" ON public.influencers;
DROP POLICY IF EXISTS "Influencers can update their own profile" ON public.influencers;
DROP POLICY IF EXISTS "Influencers can delete their own profile" ON public.influencers;

-- Allow anyone to view influencers (public profiles)
CREATE POLICY "Influencers are viewable by everyone"
ON public.influencers
FOR SELECT
USING (true);

-- Allow authenticated users to insert their own influencer profile
CREATE POLICY "Users can insert their own influencer profile"
ON public.influencers
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Allow influencers to update their own profile
CREATE POLICY "Influencers can update their own profile"
ON public.influencers
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Allow influencers to delete their own profile
CREATE POLICY "Influencers can delete their own profile"
ON public.influencers
FOR DELETE
USING (auth.uid() = id);

-- 4) Influencer reviews table: RLS policies
ALTER TABLE IF EXISTS influencer_reviews ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Influencer reviews are viewable by everyone" ON public.influencer_reviews;
DROP POLICY IF EXISTS "Authenticated users can insert reviews" ON public.influencer_reviews;

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

-- Drop existing policies first
DROP POLICY IF EXISTS "Influencers can view their own proposals" ON public.proposals;
DROP POLICY IF EXISTS "Brands can view their own proposals" ON public.proposals;
DROP POLICY IF EXISTS "Authenticated users can insert proposals" ON public.proposals;
DROP POLICY IF EXISTS "Influencers can update their own proposals" ON public.proposals;
DROP POLICY IF EXISTS "Brands can update their own proposals" ON public.proposals;

-- Allow influencers to view their own proposals
CREATE POLICY "Influencers can view their own proposals"
ON public.proposals
FOR SELECT
USING (auth.uid() = influencer_id);

-- Allow brands to view their own proposals (via email)
CREATE POLICY "Brands can view their own proposals"
ON public.proposals
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM brands 
    WHERE brands.contact_email = public.proposals.brand_email 
    AND brands.id = auth.uid()
  )
);

-- Allow authenticated users to insert proposals
CREATE POLICY "Authenticated users can insert proposals"
ON public.proposals
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Allow influencers to update their own proposals
CREATE POLICY "Influencers can update their own proposals"
ON public.proposals
FOR UPDATE
USING (auth.uid() = influencer_id)
WITH CHECK (auth.uid() = influencer_id);

-- Allow brands to update their own proposals
CREATE POLICY "Brands can update their own proposals"
ON public.proposals
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM brands 
    WHERE brands.contact_email = public.proposals.brand_email 
    AND brands.id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM brands 
    WHERE brands.contact_email = public.proposals.brand_email 
    AND brands.id = auth.uid()
  )
);

-- 6) Brands table: RLS policies
ALTER TABLE IF EXISTS brands ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Brands are viewable by everyone" ON public.brands;
DROP POLICY IF EXISTS "Users can insert their own brand profile" ON public.brands;
DROP POLICY IF EXISTS "Brands can update their own profile" ON public.brands;
DROP POLICY IF EXISTS "Brands can delete their own profile" ON public.brands;

-- Allow authenticated users to view brands (public profiles)
CREATE POLICY "Brands are viewable by everyone"
ON public.brands
FOR SELECT
USING (true);

-- Allow authenticated users to insert their own brand profile
CREATE POLICY "Users can insert their own brand profile"
ON public.brands
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Allow brands to update their own profile
CREATE POLICY "Brands can update their own profile"
ON public.brands
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Allow brands to delete their own profile
CREATE POLICY "Brands can delete their own profile"
ON public.brands
FOR DELETE
USING (auth.uid() = id);

-- 7) Re-check after fix (should return 0 rows for fixed tables):
SELECT c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND NOT c.relrowsecurity
ORDER BY c.relname;
