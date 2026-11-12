-- Exported read-only from supabase_migrations.schema_migrations (20261106195505 instagram_oauth_used_nonces); ALREADY APPLIED in production.
-- One-time OAuth state nonces for Instagram admin Unified Login (replay protection).
CREATE TABLE IF NOT EXISTS public.instagram_oauth_used_nonces (
  nonce TEXT PRIMARY KEY,
  influencer_id UUID NULL REFERENCES public.influencers(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS instagram_oauth_used_nonces_expires_idx
  ON public.instagram_oauth_used_nonces (expires_at);

ALTER TABLE public.instagram_oauth_used_nonces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS instagram_oauth_used_nonces_deny_all ON public.instagram_oauth_used_nonces;
CREATE POLICY instagram_oauth_used_nonces_deny_all ON public.instagram_oauth_used_nonces
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.instagram_oauth_used_nonces IS
  'Consumed OAuth state nonces for Instagram admin login. Service role only.';
