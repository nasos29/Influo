-- Showcase: pending brand approval for proposal post links + admin post-URL / pin audit columns.
-- Additive only. Do NOT apply to production from an agent task.

-- Proposals: creator-submitted post may need brand approval before public listing.
alter table public.proposals
  add column if not exists published_post_pending_approval boolean not null default false,
  add column if not exists showcase_post_url_updated_by text,
  add column if not exists showcase_post_url_updated_at timestamptz,
  add column if not exists showcase_admin_pinned_by text;

comment on column public.proposals.published_post_pending_approval is
  'True when creator submitted published_post_url and brand has not approved it yet.';
comment on column public.proposals.showcase_post_url_updated_by is
  'Email/id of admin (or party) who last set published_post_url.';
comment on column public.proposals.showcase_post_url_updated_at is
  'When published_post_url was last set/edited.';
comment on column public.proposals.showcase_admin_pinned_by is
  'Admin email who last pinned/unpinned this collaboration.';

-- Campaign applications: admin post-URL / pin audit (deliverable_url path).
alter table public.campaign_applications
  add column if not exists showcase_post_url_updated_by text,
  add column if not exists showcase_post_url_updated_at timestamptz,
  add column if not exists showcase_admin_pinned_by text;

comment on column public.campaign_applications.showcase_post_url_updated_by is
  'Email/id of admin (or party) who last set deliverable_url for showcase.';
comment on column public.campaign_applications.showcase_post_url_updated_at is
  'When deliverable_url was last set/edited via showcase/admin.';
comment on column public.campaign_applications.showcase_admin_pinned_by is
  'Admin email who last pinned/unpinned this collaboration.';

-- Public listing for proposals: exclude rows still pending brand approval of the post URL.
drop index if exists public.proposals_showcase_public_idx;
create index if not exists proposals_showcase_public_idx
  on public.proposals (showcase_admin_pinned desc, agreement_accepted_at desc nulls last)
  where status = 'completed'
    and brand_showcase_consent = true
    and influencer_showcase_consent = true
    and showcase_admin_hidden = false
    and published_post_pending_approval = false;
