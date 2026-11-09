-- Additive only: announcement marketing opt-out flags for Zoho Campaigns sync.
-- Default false = treated as opted-in (existing recipients keep receiving until they unsubscribe).
-- Does not change Resend behaviour while site_settings.zoho_campaigns_announcements is OFF.

alter table public.influencers
  add column if not exists announcements_email_opted_out boolean not null default false;

alter table public.brands
  add column if not exists announcements_email_opted_out boolean not null default false;

comment on column public.influencers.announcements_email_opted_out is
  'When true, exclude from Zoho Campaigns announcement lists / bulk announcement email.';

comment on column public.brands.announcements_email_opted_out is
  'When true, exclude from Zoho Campaigns announcement lists / bulk announcement email.';
