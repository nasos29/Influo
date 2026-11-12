-- One-shot agreement acceptance reminder (48–96h after the first acceptance).
-- Additive only: nullable column, no backfill (the 96h window already excludes old deals).
alter table public.proposals
  add column if not exists agreement_reminder_sent_at timestamptz;

comment on column public.proposals.agreement_reminder_sent_at is
  'When the agreement acceptance reminder was sent to the side that had not accepted yet (claimed atomically by /api/cron/agreement-reminders).';
