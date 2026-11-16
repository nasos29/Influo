-- Notification preferences (brands + influencers). Additive only.
-- Maps existing announcements_email_opted_out / reminders_email_opted_out without dropping them.
-- Do NOT apply to production from the agent; ship via PR review.

-- 1) Backup current opt-out flags (restore reference; not used by app runtime).
create table if not exists public._backup_notif_optouts_20261116 (
  kind text not null check (kind in ('brand', 'influencer')),
  subject_id uuid not null,
  announcements_email_opted_out boolean,
  reminders_email_opted_out boolean,
  backed_up_at timestamptz not null default now(),
  primary key (kind, subject_id)
);

insert into public._backup_notif_optouts_20261116 (kind, subject_id, announcements_email_opted_out, reminders_email_opted_out)
select 'brand', id, announcements_email_opted_out, reminders_email_opted_out
from public.brands
on conflict do nothing;

insert into public._backup_notif_optouts_20261116 (kind, subject_id, announcements_email_opted_out, reminders_email_opted_out)
select
  'influencer',
  id,
  announcements_email_opted_out,
  false
from public.influencers
on conflict do nothing;

comment on table public._backup_notif_optouts_20261116 is
  'Point-in-time backup of email opt-out columns before notification_preferences (2026-11-16).';

-- 2) Preferences table (default ON for every optional category).
create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  subject_kind text not null check (subject_kind in ('brand', 'influencer')),
  subject_id uuid not null,
  matches_email boolean not null default true,
  reminders_email boolean not null default true,
  announcements_email boolean not null default true,
  in_site boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_preferences_subject_uidx unique (subject_kind, subject_id)
);

create index if not exists notification_preferences_brand_idx
  on public.notification_preferences (subject_id)
  where subject_kind = 'brand';

create index if not exists notification_preferences_influencer_idx
  on public.notification_preferences (subject_id)
  where subject_kind = 'influencer';

comment on table public.notification_preferences is
  'Per-user optional notification toggles. Essential transactional emails are always on (not stored).';
comment on column public.notification_preferences.matches_email is
  'New matching campaigns / category outreach emails.';
comment on column public.notification_preferences.reminders_email is
  'Reminders: reviews, draft campaign, brand weekly nudge, agreement nudge.';
comment on column public.notification_preferences.announcements_email is
  'Influo updates / newsletter / announcements by email. Synced with *_announcements_email_opted_out.';
comment on column public.notification_preferences.in_site is
  'In-site (bell) preference for non-announcement UI alerts. Platform announcements always show.';

-- 3) Seed from legacy opt-outs (opted_out=true → preference false). Defaults otherwise.
insert into public.notification_preferences (
  subject_kind,
  subject_id,
  matches_email,
  reminders_email,
  announcements_email,
  in_site
)
select
  'brand',
  b.id,
  true,
  not coalesce(b.reminders_email_opted_out, false),
  not coalesce(b.announcements_email_opted_out, false),
  true
from public.brands b
on conflict (subject_kind, subject_id) do update
set
  reminders_email = excluded.reminders_email,
  announcements_email = excluded.announcements_email,
  updated_at = now();

insert into public.notification_preferences (
  subject_kind,
  subject_id,
  matches_email,
  reminders_email,
  announcements_email,
  in_site
)
select
  'influencer',
  i.id,
  true,
  true,
  not coalesce(i.announcements_email_opted_out, false),
  true
from public.influencers i
on conflict (subject_kind, subject_id) do update
set
  announcements_email = excluded.announcements_email,
  updated_at = now();

-- 4) RLS: owners manage own row; service role bypasses.
alter table public.notification_preferences enable row level security;

drop policy if exists "notification_preferences_select_own" on public.notification_preferences;
create policy "notification_preferences_select_own"
  on public.notification_preferences
  for select
  to authenticated
  using (
    (
      subject_kind = 'brand'
      and subject_id = auth.uid()
    )
    or (
      subject_kind = 'influencer'
      and exists (
        select 1
        from public.influencers inf
        where inf.id = subject_id
          and inf.auth_user_id = auth.uid()
      )
    )
  );

drop policy if exists "notification_preferences_insert_own" on public.notification_preferences;
create policy "notification_preferences_insert_own"
  on public.notification_preferences
  for insert
  to authenticated
  with check (
    (
      subject_kind = 'brand'
      and subject_id = auth.uid()
    )
    or (
      subject_kind = 'influencer'
      and exists (
        select 1
        from public.influencers inf
        where inf.id = subject_id
          and inf.auth_user_id = auth.uid()
      )
    )
  );

drop policy if exists "notification_preferences_update_own" on public.notification_preferences;
create policy "notification_preferences_update_own"
  on public.notification_preferences
  for update
  to authenticated
  using (
    (
      subject_kind = 'brand'
      and subject_id = auth.uid()
    )
    or (
      subject_kind = 'influencer'
      and exists (
        select 1
        from public.influencers inf
        where inf.id = subject_id
          and inf.auth_user_id = auth.uid()
      )
    )
  )
  with check (
    (
      subject_kind = 'brand'
      and subject_id = auth.uid()
    )
    or (
      subject_kind = 'influencer'
      and exists (
        select 1
        from public.influencers inf
        where inf.id = subject_id
          and inf.auth_user_id = auth.uid()
      )
    )
  );

grant select, insert, update on public.notification_preferences to authenticated;
grant all on public.notification_preferences to service_role;
