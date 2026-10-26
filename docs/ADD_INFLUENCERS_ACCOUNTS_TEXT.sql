-- Optional: enable admin username search (accounts JSON) via a stored text column.
-- Apply manually in the Supabase SQL editor. Safe to re-run.
-- Without this, /api/admin/influencers search still matches display_name, contact_email, location.

ALTER TABLE public.influencers
  ADD COLUMN IF NOT EXISTS accounts_text text
  GENERATED ALWAYS AS (accounts::text) STORED;

COMMENT ON COLUMN public.influencers.accounts_text IS
  'Generated accounts::text for admin ilike search (usernames).';

CREATE INDEX IF NOT EXISTS influencers_accounts_text_ilike_idx
  ON public.influencers (accounts_text);

NOTIFY pgrst, 'reload schema';
