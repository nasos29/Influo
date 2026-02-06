-- Remove Facebook accounts from all influencers.
-- Run in Supabase SQL Editor after removing Facebook from the platform.
-- This removes any account where platform = 'Facebook' (case-insensitive).

UPDATE influencers
SET accounts = (
  SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
  FROM jsonb_array_elements(COALESCE(accounts, '[]'::jsonb)) elem
  WHERE lower(elem->>'platform') IS DISTINCT FROM 'facebook'
)
WHERE accounts IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(accounts, '[]'::jsonb)) elem
    WHERE lower(elem->>'platform') = 'facebook'
  );

-- Verify: run after migration to check no Facebook accounts remain
-- SELECT id, display_name, accounts FROM influencers WHERE accounts::text ILIKE '%facebook%';
