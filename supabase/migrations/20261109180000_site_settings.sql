-- Additive only: site_settings key/value store for admin-tunable display/lifecycle knobs.
-- Snapshot note (before apply): no existing tables changed; take a Supabase backup or
-- SQL dump of public schema if you want a restore point. This migration only CREATEs.

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

comment on table public.site_settings is
  'Admin-tunable site knobs (card density, homepage counts, retention). No secrets.';

alter table public.site_settings enable row level security;

-- Public read for non-sensitive display keys (all keys in this table are non-secret).
-- Writes go through the server with the service role (no INSERT/UPDATE/DELETE policies).
drop policy if exists site_settings_public_read on public.site_settings;
create policy site_settings_public_read
  on public.site_settings
  for select
  to anon, authenticated
  using (true);

grant select on public.site_settings to anon, authenticated;
