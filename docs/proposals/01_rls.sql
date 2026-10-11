-- Προτάσεις: μόνο οι δύο πλευρές διαβάζουν από τον browser.
-- Τρέξτε το ΜΕΤΑ το deploy. Idempotent. Rollback: 99_rollback.sql
--
-- Εγγραφή, αποδοχή, απόρριψη, αντιπρόταση και συμφωνία γίνονται από τα
-- /api/proposals (service role). Ο admin διαβάζει από το /api/admin/proposals.
-- Το service role παρακάμπτει το RLS.
--
-- Όλο το αρχείο είναι ένα transaction.

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

GRANT SELECT ON public.proposals TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.proposals FROM anon, authenticated;
REVOKE ALL ON public.proposals FROM anon;

-- Influencer: id του προφίλ, ή η γραμμή του στον influencer_private.
-- Brand: email του JWT, brand_id, ή η γραμμή του στον brand_private.
CREATE POLICY proposals_select_party ON public.proposals
  FOR SELECT TO authenticated
  USING (
    influencer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.influencer_private p
      WHERE p.influencer_id = proposals.influencer_id
        AND (
          p.auth_user_id = auth.uid()
          OR lower(coalesce(p.contact_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
    OR lower(coalesce(brand_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
    OR (brand_id IS NOT NULL AND brand_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.brand_private b
      WHERE b.brand_id = auth.uid()
        AND lower(coalesce(b.contact_email, '')) = lower(coalesce(proposals.brand_email, ''))
    )
  );

NOTIFY pgrst, 'reload schema';
COMMIT;
