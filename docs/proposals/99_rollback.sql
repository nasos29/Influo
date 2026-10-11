-- Rollback του 01_rls.sql.
-- Επαναφέρει τις πολιτικές του docs/SUPABASE_RLS_SECURITY_FIX.sql.
-- Δεν σβήνει προτάσεις ούτε στήλες.
--
-- Προσοχή: αυτές οι πολιτικές ξανανοίγουν INSERT σε κάθε συνδεδεμένο χρήστη
-- και UPDATE στις δύο πλευρές. Η ανάγνωση της επιχείρησης κοιτάζει
-- brands.contact_email, που ο browser μπορεί να μην βλέπει.

BEGIN;
SET LOCAL lock_timeout = '15s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'proposals'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.proposals', r.policyname);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.proposals TO authenticated;
REVOKE ALL ON public.proposals FROM anon;

CREATE POLICY "Influencers can view their own proposals"
ON public.proposals
FOR SELECT
USING (auth.uid() = influencer_id);

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

CREATE POLICY "Authenticated users can insert proposals"
ON public.proposals
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Influencers can update their own proposals"
ON public.proposals
FOR UPDATE
USING (auth.uid() = influencer_id)
WITH CHECK (auth.uid() = influencer_id);

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

NOTIFY pgrst, 'reload schema';
COMMIT;
