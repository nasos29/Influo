-- Brand public profile fields (bio / website / Instagram / city)
-- Apply manually in the Supabase SQL editor. Do not run from the app.
--
-- Existing: brands.bio, brands.website
-- New: brands.instagram, brands.city
-- brand_private stays private (contact_email only) — no public bio there.

ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS bio TEXT;

ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS website TEXT;

ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS instagram TEXT;

ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS city TEXT;

COMMENT ON COLUMN brands.bio IS 'Public brand bio (max 600 chars, no phone/email/links in free text).';
COMMENT ON COLUMN brands.website IS 'Public https website URL.';
COMMENT ON COLUMN brands.instagram IS 'Public https Instagram profile URL (instagram.com only).';
COMMENT ON COLUMN brands.city IS 'Public city / location label.';

-- Soft length guard for bio (nullable / empty allowed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'brands_bio_length_check'
  ) THEN
    ALTER TABLE brands
      ADD CONSTRAINT brands_bio_length_check
      CHECK (bio IS NULL OR char_length(bio) <= 600);
  END IF;
END $$;

-- Column-level grants (matches docs/influencer-private/02_revoke_browser_private_columns.sql):
-- new columns are not included until GRANT is refreshed.
GRANT SELECT (bio, website, instagram, city) ON TABLE public.brands TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
