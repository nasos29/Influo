-- Allow brands to sign up without AFM (optional field).
-- Run in Supabase SQL Editor if brands.afm is currently NOT NULL.
-- After this, new brands can have afm = NULL and add it later in dashboard.

ALTER TABLE brands
  ALTER COLUMN afm DROP NOT NULL;

-- Optional: add a comment
COMMENT ON COLUMN brands.afm IS 'Tax ID (9 digits). Optional at signup; can be added later in dashboard.';
