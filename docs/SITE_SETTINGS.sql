-- Additive: public.site_settings (admin-tunable display/lifecycle knobs).
-- Before applying: take a Supabase backup / snapshot of project rljegispdrlvoyhnefuv
-- (Dashboard → Project Settings → Database → Backups, or pg_dump). This SQL only
-- CREATE TABLEs; it does not ALTER existing tables or touch existing rows.
--
-- Same contents as supabase/migrations/20261109180000_site_settings.sql

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

comment on table public.site_settings is
  'Admin-tunable site knobs (card density, homepage counts, retention). No secrets.';

alter table public.site_settings enable row level security;

drop policy if exists site_settings_public_read on public.site_settings;
create policy site_settings_public_read
  on public.site_settings
  for select
  to anon, authenticated
  using (true);

grant select on public.site_settings to anon, authenticated;
