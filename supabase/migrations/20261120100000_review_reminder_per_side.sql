-- Per-party review reminder stamps (proposals + campaign applications).
-- Legacy review_reminder_sent_at that equals agreement_accepted_at was a migration backfill, not a real send.

alter table public.proposals
  add column if not exists brand_review_reminder_sent_at timestamptz,
  add column if not exists influencer_review_reminder_sent_at timestamptz,
  add column if not exists brand_review_reminder_second_sent_at timestamptz,
  add column if not exists influencer_review_reminder_second_sent_at timestamptz,
  add column if not exists publish_deadline_pending text,
  add column if not exists publish_deadline_pending_by text,
  add column if not exists publish_deadline_pending_at timestamptz;

alter table public.campaign_applications
  add column if not exists brand_review_reminder_sent_at timestamptz,
  add column if not exists influencer_review_reminder_sent_at timestamptz,
  add column if not exists brand_review_reminder_second_sent_at timestamptz,
  add column if not exists influencer_review_reminder_second_sent_at timestamptz;

comment on column public.proposals.brand_review_reminder_sent_at is
  'When the brand received the first delayed review reminder for this deal.';
comment on column public.proposals.influencer_review_reminder_sent_at is
  'When the creator received the first delayed review reminder for this deal.';

-- Drop bogus backfill stamps (same instant as agreement lock).
update public.proposals
set review_reminder_sent_at = null,
    review_reminder_second_sent_at = null
where review_reminder_sent_at is not null
  and agreement_accepted_at is not null
  and review_reminder_sent_at = agreement_accepted_at;

-- Migrate real legacy combined stamps to both sides when per-side columns are empty.
update public.proposals
set
  brand_review_reminder_sent_at = coalesce(brand_review_reminder_sent_at, review_reminder_sent_at),
  influencer_review_reminder_sent_at = coalesce(influencer_review_reminder_sent_at, review_reminder_sent_at)
where review_reminder_sent_at is not null;

update public.proposals
set
  brand_review_reminder_second_sent_at = coalesce(brand_review_reminder_second_sent_at, review_reminder_second_sent_at),
  influencer_review_reminder_second_sent_at = coalesce(influencer_review_reminder_second_sent_at, review_reminder_second_sent_at)
where review_reminder_second_sent_at is not null;

update public.campaign_applications
set review_reminder_sent_at = null,
    review_reminder_second_sent_at = null
where review_reminder_sent_at is not null
  and review_reminder_sent_at = coalesce(reviewed_at, created_at);

update public.campaign_applications
set
  brand_review_reminder_sent_at = coalesce(brand_review_reminder_sent_at, review_reminder_sent_at),
  influencer_review_reminder_sent_at = coalesce(influencer_review_reminder_sent_at, review_reminder_sent_at)
where review_reminder_sent_at is not null;

update public.campaign_applications
set
  brand_review_reminder_second_sent_at = coalesce(brand_review_reminder_second_sent_at, review_reminder_second_sent_at),
  influencer_review_reminder_second_sent_at = coalesce(influencer_review_reminder_second_sent_at, review_reminder_second_sent_at)
where review_reminder_second_sent_at is not null;