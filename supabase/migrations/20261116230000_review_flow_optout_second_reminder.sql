-- Review flow: public SELECT grants, second reminder stamp, per-party prompt decline.
-- Additive only. Does NOT reset review_reminder_sent_at (historical anti-spam stamps stay).

-- RLS already has "viewable by everyone" SELECT policy, but table GRANT SELECT was missing
-- for anon/authenticated (insert/update existed). API uses service_role; grant still needed
-- for any client-side reads and for policy to be meaningful.
grant select on table public.influencer_reviews to anon, authenticated;

alter table public.proposals
  add column if not exists review_reminder_second_sent_at timestamptz;

comment on column public.proposals.review_reminder_second_sent_at is
  'When the second (final) review-reminder email was sent, 7 days after the first if still no review.';

alter table public.proposals
  add column if not exists brand_review_prompts_declined_at timestamptz;

alter table public.proposals
  add column if not exists influencer_review_prompts_declined_at timestamptz;

comment on column public.proposals.brand_review_prompts_declined_at is
  'Brand chose «Όχι, ευχαριστώ» — stop review + post-link prompts/emails for this deal for the brand.';

comment on column public.proposals.influencer_review_prompts_declined_at is
  'Creator chose «Όχι, ευχαριστώ» — stop review + post-link prompts/emails for this deal for the creator.';
