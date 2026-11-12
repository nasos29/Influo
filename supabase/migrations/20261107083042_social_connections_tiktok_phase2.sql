-- Exported read-only from supabase_migrations.schema_migrations (20261107083042 social_connections_tiktok_phase2); ALREADY APPLIED in production.
-- Phase 2 (TikTok prep): widen platform CHECK and add provider-neutral identity + refresh token columns.
-- Additive only. Does not drop/rename Instagram columns or rewrite existing rows.

-- Drop Instagram-only CHECK (Postgres default name for column CHECK).
ALTER TABLE public.social_connections
  DROP CONSTRAINT IF EXISTS social_connections_platform_check;

ALTER TABLE public.social_connections
  ADD CONSTRAINT social_connections_platform_check
  CHECK (platform IN ('instagram', 'tiktok'));

-- Generic provider subject id (TikTok open_id). Instagram continues to use ig_user_id.
ALTER TABLE public.social_connections
  ADD COLUMN IF NOT EXISTS platform_user_id TEXT;

-- TikTok (and future providers) refresh token lifecycle. Nullable for Instagram rows.
ALTER TABLE public.social_connections
  ADD COLUMN IF NOT EXISTS encrypted_refresh_token TEXT;

ALTER TABLE public.social_connections
  ADD COLUMN IF NOT EXISTS refresh_token_expires_at TIMESTAMPTZ;

-- OAuth scopes granted by the user (TikTok Login Kit). Do NOT reuse config_id
-- (config_id remains Meta Instagram Login config id only).
ALTER TABLE public.social_connections
  ADD COLUMN IF NOT EXISTS granted_scopes TEXT[];

-- UNIQUE (influencer_id, platform) and RLS deny-all policy remain unchanged.

COMMENT ON TABLE public.social_connections IS
  'Encrypted OAuth tokens for social providers (instagram, tiktok). Service role only.';
COMMENT ON COLUMN public.social_connections.platform_user_id IS
  'Provider-neutral user id (e.g. TikTok open_id). Instagram uses ig_user_id; leave null for IG rows.';
COMMENT ON COLUMN public.social_connections.encrypted_refresh_token IS
  'AES-256-GCM refresh token (iv:tag:cipher). Never expose to clients.';
COMMENT ON COLUMN public.social_connections.refresh_token_expires_at IS
  'When encrypted_refresh_token expires (provider-specific).';
COMMENT ON COLUMN public.social_connections.granted_scopes IS
  'OAuth scopes granted for this connection (e.g. TikTok user.info.basic). Instagram leaves null; never store TikTok scopes in config_id.';
COMMENT ON COLUMN public.social_connections.config_id IS
  'Meta Instagram Login config_id only. Not used for TikTok scopes.';
