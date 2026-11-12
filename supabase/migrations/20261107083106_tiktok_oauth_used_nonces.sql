-- Exported read-only from supabase_migrations.schema_migrations (20261107083106 tiktok_oauth_used_nonces); ALREADY APPLIED in production.
-- One-time OAuth state nonces for TikTok admin Login Kit (replay protection).
-- Separate from instagram_oauth_used_nonces so providers cannot share nonce PK space.

CREATE TABLE IF NOT EXISTS public.tiktok_oauth_used_nonces (
  nonce TEXT PRIMARY KEY,
  influencer_id UUID NULL REFERENCES public.influencers(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS tiktok_oauth_used_nonces_expires_idx
  ON public.tiktok_oauth_used_nonces (expires_at);

ALTER TABLE public.tiktok_oauth_used_nonces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tiktok_oauth_used_nonces_deny_all ON public.tiktok_oauth_used_nonces;
CREATE POLICY tiktok_oauth_used_nonces_deny_all ON public.tiktok_oauth_used_nonces
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.tiktok_oauth_used_nonces IS
  'Consumed OAuth state nonces for TikTok admin login. Service role only.';
