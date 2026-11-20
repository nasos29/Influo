-- Stamp missing social account creator emails (one per influencer+platform+handle). Service role only.

create table if not exists public.influencer_missing_account_notified (
  id uuid primary key default gen_random_uuid(),
  influencer_id uuid not null references public.influencers(id) on delete cascade,
  platform text not null,
  handle text not null,
  notified_at timestamptz not null default now(),
  constraint influencer_missing_account_notified_handle_len check (char_length(handle) between 1 and 128),
  constraint influencer_missing_account_notified_platform_len check (char_length(platform) between 1 and 32)
);

create unique index if not exists influencer_missing_account_notified_uidx
  on public.influencer_missing_account_notified (influencer_id, platform, handle);

create index if not exists influencer_missing_account_notified_influencer_idx
  on public.influencer_missing_account_notified (influencer_id, notified_at desc);

comment on table public.influencer_missing_account_notified is
  'Creator email sent when social refresh could not find a declared handle. Cleared when account scans OK again.';

alter table public.influencer_missing_account_notified enable row level security;
-- No policies: cron / service role only.