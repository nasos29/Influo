-- Rollback και για το 01 και για το 02.
-- Επαναφέρει:
--   * SELECT όλων των στηλών σε anon / authenticated
--   * τις αρχικές πολιτικές proposals και support_tickets (όπως ήταν στο live)
-- και σβήνει τους πίνακες influencer_private / brand_private.
-- Δεν σβήνει στήλες του influencers. Τα δεδομένα μένουν εκεί.
-- Ένα transaction. Μπορεί να ξανατρέξει.

BEGIN;
SET LOCAL lock_timeout = '15s';
SET LOCAL statement_timeout = '120s';

DROP TRIGGER IF EXISTS trg_sync_influencer_private ON public.influencers;
DROP TRIGGER IF EXISTS trg_delete_influencer_private ON public.influencers;
DROP TRIGGER IF EXISTS trg_sync_influencer_public ON public.influencer_private;
DROP TRIGGER IF EXISTS trg_sync_brand_private ON public.brands;
DROP TRIGGER IF EXISTS trg_delete_brand_private ON public.brands;
DROP TRIGGER IF EXISTS trg_sync_brand_public ON public.brand_private;

DROP FUNCTION IF EXISTS public.sync_influencer_private_from_public();
DROP FUNCTION IF EXISTS public.sync_influencer_public_from_private();
DROP FUNCTION IF EXISTS public.sync_brand_private_from_public();
DROP FUNCTION IF EXISTS public.sync_brand_public_from_private();
DROP FUNCTION IF EXISTS public.delete_influencer_private_row();
DROP FUNCTION IF EXISTS public.delete_brand_private_row();
DROP FUNCTION IF EXISTS public.brand_account_exists(text);

-- Πρώτα οι πολιτικές που δείχνουν στους private πίνακες, μετά DROP των πινάκων.
DROP POLICY IF EXISTS "Brands can view their own proposals" ON public.proposals;
DROP POLICY IF EXISTS "Brands can update their own proposals" ON public.proposals;

CREATE POLICY "Brands can view their own proposals"
ON public.proposals
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.brands
    WHERE brands.contact_email = proposals.brand_email
      AND brands.id = auth.uid()
  )
);

CREATE POLICY "Brands can update their own proposals"
ON public.proposals
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.brands
    WHERE brands.contact_email = proposals.brand_email
      AND brands.id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.brands
    WHERE brands.contact_email = proposals.brand_email
      AND brands.id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can view their own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can create tickets" ON public.support_tickets;

CREATE POLICY "Users can view their own tickets"
ON public.support_tickets
FOR SELECT
TO public
USING (
  (
    (user_type = 'influencer')
    AND user_id IN (
      SELECT influencers.id::text
      FROM public.influencers
      WHERE influencers.contact_email = (
        SELECT users.email::text FROM auth.users WHERE users.id = auth.uid()
      )
    )
  )
  OR (
    (user_type = 'brand')
    AND user_email = (
      SELECT users.email::text FROM auth.users WHERE users.id = auth.uid()
    )
  )
);

CREATE POLICY "Users can create tickets"
ON public.support_tickets
FOR INSERT
TO public
WITH CHECK (
  (
    (user_type = 'influencer')
    AND user_id IN (
      SELECT influencers.id::text
      FROM public.influencers
      WHERE influencers.contact_email = (
        SELECT users.email::text FROM auth.users WHERE users.id = auth.uid()
      )
    )
  )
  OR (
    (user_type = 'brand')
    AND user_email = (
      SELECT users.email::text FROM auth.users WHERE users.id = auth.uid()
    )
  )
);

DROP TABLE IF EXISTS public.influencer_private;
DROP TABLE IF EXISTS public.brand_private;

DO $$
BEGIN
  IF to_regclass('public.influencers') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE public.influencers TO anon, authenticated';
  END IF;
  IF to_regclass('public.brands') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE public.brands TO anon, authenticated';
  END IF;
  IF to_regclass('public.influencer_reviews') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE public.influencer_reviews TO anon, authenticated';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
