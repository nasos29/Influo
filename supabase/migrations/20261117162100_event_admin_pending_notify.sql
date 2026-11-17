-- Event-mode pending admin notify stamp (additive only).
-- Do NOT apply to production from this PR without explicit ops approval.
-- Auto-complete is link-mode only; event mode past 7 days notifies admin instead.

alter table public.proposals
  add column if not exists event_admin_pending_notified_at timestamptz;

comment on column public.proposals.event_admin_pending_notified_at is
  'When admin was notified (digest) that an event delivery awaits confirmation after 7 days.';

comment on column public.proposals.auto_completed_at is
  'Link-mode safety-net completion when brand did not respond within 7 days of a published-link submission. Never set for event mode or unsubmitted deals.';

alter table public.campaign_applications
  add column if not exists event_admin_pending_notified_at timestamptz;

comment on column public.campaign_applications.event_admin_pending_notified_at is
  'When admin was notified (digest) that an event delivery awaits confirmation after 7 days.';

comment on column public.campaign_applications.auto_completed_at is
  'Link-mode safety-net completion when brand did not respond within 7 days of a published-link submission. Never set for event mode or unsubmitted deals.';
