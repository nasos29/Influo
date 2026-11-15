-- Brand campaign reminder emails/push (draft nudge, no-campaign nudge, target/closed events).
-- Additive only: new table + opt-out column. Do NOT apply to production from the agent.

create table if not exists public.brand_reminder_log (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  campaign_id uuid references public.brand_campaigns(id) on delete set null,
  kind text not null,
  channel text not null default 'email',
  meta jsonb,
  created_at timestamptz not null default now(),
  constraint brand_reminder_log_kind_check check (char_length(kind) between 1 and 64),
  constraint brand_reminder_log_channel_check check (char_length(channel) between 1 and 32)
);

comment on table public.brand_reminder_log is
  'Sent brand campaign reminders / event notices (dedupe + rate-limit audit). Service role only.';

-- One send per (campaign, kind) for campaign-scoped kinds (draft_day3/10, target_reached, campaign_closed).
create unique index if not exists brand_reminder_log_campaign_kind_uidx
  on public.brand_reminder_log (campaign_id, kind)
  where campaign_id is not null;

create index if not exists brand_reminder_log_brand_created_idx
  on public.brand_reminder_log (brand_id, created_at desc);

create index if not exists brand_reminder_log_brand_kind_idx
  on public.brand_reminder_log (brand_id, kind, created_at desc);

alter table public.brand_reminder_log enable row level security;
-- No policies: service role (cron) only.

alter table public.brands
  add column if not exists reminders_email_opted_out boolean not null default false;

comment on column public.brands.reminders_email_opted_out is
  'When true, exclude from polite brand campaign reminder emails (draft / no-campaign nudges). Event emails still respect announcements_email_opted_out.';
