-- Exported read-only from supabase_migrations.schema_migrations (20261106185509 social_connections_spike); ALREADY APPLIED in production.
-- Instagram Unified Login spike: encrypted per-creator connections.
-- Additive only. Tokens must never be readable by anon/authenticated.

CREATE TABLE IF NOT EXISTS public.social_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform = 'instagram'),
  ig_user_id TEXT,
  username TEXT,
  client_business_id TEXT,
  encrypted_access_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  config_id TEXT,
  graph_version TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  last_spike_report JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (influencer_id, platform)
);

CREATE INDEX IF NOT EXISTS social_connections_influencer_idx
  ON public.social_connections (influencer_id);

ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS social_connections_deny_all ON public.social_connections;
CREATE POLICY social_connections_deny_all ON public.social_connections
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.social_connections IS
  'Encrypted OAuth tokens for Instagram Unified Login (BISU/SUAT). Service role only.';
COMMENT ON COLUMN public.social_connections.encrypted_access_token IS
  'AES-256-GCM payload (iv:tag:cipher). Never expose to clients.';
