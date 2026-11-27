-- Allow gender 'AI' in addition to Female / Male / Other.
-- The signup form has stored 'AI' (formerly 'Other') since 1740ebe (2026-09-20),
-- but this check constraint was never updated, so creator signup with AI
-- failed with HTTP 400 (23514 / influencers_gender_check).
-- Idempotent: safe to re-run on a database that already has the new check.

ALTER TABLE public.influencers DROP CONSTRAINT IF EXISTS influencers_gender_check;

ALTER TABLE public.influencers ADD CONSTRAINT influencers_gender_check
  CHECK ((gender IS NULL) OR (gender = ANY (ARRAY['Female'::text, 'Male'::text, 'Other'::text, 'AI'::text])));
