-- Track when the post-collaboration review reminder email was sent (once per deal).
alter table public.proposals
  add column if not exists review_reminder_sent_at timestamptz;

comment on column public.proposals.review_reminder_sent_at is
  'When the delayed review-reminder email was sent after the deal finished (publish_deadline or fallback days).';

-- Do not backfill-spam historical deals when the cron first runs.
update public.proposals
set review_reminder_sent_at = coalesce(agreement_accepted_at, now())
where status = 'completed'
  and review_reminder_sent_at is null;
