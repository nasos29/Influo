-- Additive only: announcement marketing opt-out flags for Zoho Campaigns sync.
-- Same as supabase/migrations/20261110010000_announcements_email_opt_out.sql
-- Before applying: take a Supabase backup / snapshot of project rljegispdrlvoyhnefuv.

alter table public.influencers
  add column if not exists announcements_email_opted_out boolean not null default false;

alter table public.brands
  add column if not exists announcements_email_opted_out boolean not null default false;

comment on column public.influencers.announcements_email_opted_out is
  'When true, exclude from Zoho Campaigns announcement lists / bulk announcement email.';

comment on column public.brands.announcements_email_opted_out is
  'When true, exclude from Zoho Campaigns announcement lists / bulk announcement email.';
