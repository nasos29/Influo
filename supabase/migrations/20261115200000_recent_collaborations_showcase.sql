-- Recent collaborations social proof (additive only). Do NOT apply to production from this task.
-- Dual consent (brand + influencer) required before a completed deal is eligible for public listing.
-- Default consent OFF. Admin can hide/pin. Stats cache refreshed at most once per day (server-side).

-- Proposals (direct collaborations)
alter table public.proposals
  add column if not exists brand_showcase_consent boolean not null default false,
  add column if not exists influencer_showcase_consent boolean not null default false,
  add column if not exists published_post_url text,
  add column if not exists self_reported_views bigint,
  add column if not exists self_reported_reach bigint,
  add column if not exists showcase_admin_hidden boolean not null default false,
  add column if not exists showcase_admin_pinned boolean not null default false,
  add column if not exists showcase_admin_pinned_at timestamptz;

comment on column public.proposals.brand_showcase_consent is
  'Brand opt-in to show this completed collaboration publicly. Default false.';
comment on column public.proposals.influencer_showcase_consent is
  'Influencer opt-in to show this completed collaboration publicly. Default false.';
comment on column public.proposals.published_post_url is
  'HTTPS Instagram / TikTok / YouTube post URL only. Never store video files.';
comment on column public.proposals.self_reported_views is
  'Optional influencer self-reported views; UI must label as δηλωμένα.';
comment on column public.proposals.self_reported_reach is
  'Optional influencer self-reported reach; UI must label as δηλωμένα.';
comment on column public.proposals.showcase_admin_hidden is
  'Admin hide from public recent-collaborations section.';
comment on column public.proposals.showcase_admin_pinned is
  'Admin pin to top of public recent-collaborations section.';

create index if not exists proposals_showcase_public_idx
  on public.proposals (showcase_admin_pinned desc, agreement_accepted_at desc nulls last)
  where status = 'completed'
    and brand_showcase_consent = true
    and influencer_showcase_consent = true
    and showcase_admin_hidden = false;

-- Campaign applications (delivery path)
alter table public.campaign_applications
  add column if not exists brand_showcase_consent boolean not null default false,
  add column if not exists influencer_showcase_consent boolean not null default false,
  add column if not exists self_reported_views bigint,
  add column if not exists self_reported_reach bigint,
  add column if not exists showcase_admin_hidden boolean not null default false,
  add column if not exists showcase_admin_pinned boolean not null default false,
  add column if not exists showcase_admin_pinned_at timestamptz;

comment on column public.campaign_applications.brand_showcase_consent is
  'Brand opt-in to show this approved deliverable publicly. Default false.';
comment on column public.campaign_applications.influencer_showcase_consent is
  'Influencer opt-in to show this approved deliverable publicly. Default false.';
comment on column public.campaign_applications.self_reported_views is
  'Optional influencer self-reported views; UI must label as δηλωμένα.';
comment on column public.campaign_applications.self_reported_reach is
  'Optional influencer self-reported reach; UI must label as δηλωμένα.';

create index if not exists campaign_applications_showcase_public_idx
  on public.campaign_applications (showcase_admin_pinned desc, reviewed_at desc nulls last)
  where deliverable_status = 'approved'
    and brand_showcase_consent = true
    and influencer_showcase_consent = true
    and showcase_admin_hidden = false;

-- Daily social-proof numbers cache (service role only; minimizes egress on home/campaigns).
create table if not exists public.platform_social_proof_stats (
  id text primary key default 'global',
  completed_collaborations integer not null default 0,
  active_creators integer not null default 0,
  brands_count integer not null default 0,
  average_rating numeric(4, 2),
  computed_at timestamptz not null default now()
);

alter table public.platform_social_proof_stats enable row level security;
revoke all on table public.platform_social_proof_stats from public, anon, authenticated;

comment on table public.platform_social_proof_stats is
  'Cached platform social-proof counters. Refreshed at most once per day by server code. No client RLS policies.';

insert into public.platform_social_proof_stats (id)
values ('global')
on conflict (id) do nothing;
