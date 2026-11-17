-- Real delivery completion + email digest queue (additive only).
-- Do NOT apply to production from this PR without explicit ops approval.
-- Keeps existing status='completed' (agreement lock) semantics; adds delivery_* stamps.

-- ── Proposals: delivery confirmation ─────────────────────────────────────────
alter table public.proposals
  add column if not exists delivery_mode text,
  add column if not exists delivery_note text,
  add column if not exists delivery_proof_url text,
  add column if not exists delivery_submitted_at timestamptz,
  add column if not exists delivery_confirmed_at timestamptz,
  add column if not exists auto_completed_at timestamptz,
  add column if not exists deliverable_reminder_before_sent_at timestamptz,
  add column if not exists deliverable_reminder_1d_after_sent_at timestamptz,
  add column if not exists deliverable_reminder_5d_after_sent_at timestamptz,
  add column if not exists brand_approve_reminder_sent_at timestamptz,
  add column if not exists showcase_event_admin_allowed boolean not null default false;

comment on column public.proposals.delivery_mode is
  'link | event — how the creator marked delivery. Null until submitted.';
comment on column public.proposals.delivery_note is
  'Optional short note with event/in-person delivery confirmation.';
comment on column public.proposals.delivery_proof_url is
  'Optional photo/story proof URL for event deliveries (not a public video post).';
comment on column public.proposals.delivery_submitted_at is
  'When the creator submitted a link or event confirmation (pending brand).';
comment on column public.proposals.delivery_confirmed_at is
  'Real completion: brand approved link or confirmed event presence.';
comment on column public.proposals.auto_completed_at is
  'Safety-net completion when brand did not respond within 7 days of submission.';
comment on column public.proposals.showcase_event_admin_allowed is
  'Admin may show an event-mode collab publicly (photo proof); video-only rule still applies otherwise.';

create index if not exists proposals_delivery_pending_idx
  on public.proposals (delivery_submitted_at)
  where delivery_submitted_at is not null
    and delivery_confirmed_at is null
    and auto_completed_at is null;

create index if not exists proposals_delivery_confirmed_idx
  on public.proposals (delivery_confirmed_at)
  where delivery_confirmed_at is not null or auto_completed_at is not null;

-- ── Campaign applications: same delivery stamps ───────────────────────────────
alter table public.campaign_applications
  add column if not exists delivery_mode text,
  add column if not exists delivery_proof_url text,
  add column if not exists delivery_submitted_at timestamptz,
  add column if not exists delivery_confirmed_at timestamptz,
  add column if not exists auto_completed_at timestamptz,
  add column if not exists brand_approve_reminder_sent_at timestamptz,
  add column if not exists showcase_event_admin_allowed boolean not null default false;

comment on column public.campaign_applications.delivery_mode is
  'link | event — how the creator marked delivery. Null until submitted.';
comment on column public.campaign_applications.delivery_proof_url is
  'Optional photo/story proof URL for event deliveries.';
comment on column public.campaign_applications.delivery_submitted_at is
  'When the creator submitted deliverable (link or event). Mirrors delivered_at when set.';
comment on column public.campaign_applications.delivery_confirmed_at is
  'Real completion: brand approved deliverable or confirmed event.';
comment on column public.campaign_applications.auto_completed_at is
  'Safety-net completion when brand did not respond within 7 days of submission.';
comment on column public.campaign_applications.showcase_event_admin_allowed is
  'Admin may show an event-mode campaign collab publicly when photo proof exists.';

create index if not exists campaign_applications_delivery_pending_idx
  on public.campaign_applications (delivery_submitted_at)
  where delivery_submitted_at is not null
    and delivery_confirmed_at is null
    and auto_completed_at is null;

-- ── Email digest queue (replaces JSON file queues; service-role only) ────────
create table if not exists public.email_digest_queue (
  id uuid primary key default gen_random_uuid(),
  digest_type text not null,
  recipient_kind text not null,
  recipient_id text,
  recipient_email text,
  group_key text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  flushed_at timestamptz
);

comment on table public.email_digest_queue is
  'Queued digest email items (brand application batches, admin daily digest). Service-role only.';
comment on column public.email_digest_queue.digest_type is
  'brand_campaign_applications | admin_daily | admin_campaign_application | …';
comment on column public.email_digest_queue.recipient_kind is
  'brand | admin';
comment on column public.email_digest_queue.group_key is
  'Batch key e.g. campaign:<uuid> or admin:daily';

create index if not exists email_digest_queue_pending_idx
  on public.email_digest_queue (digest_type, group_key, created_at)
  where flushed_at is null;

create index if not exists email_digest_queue_flushed_idx
  on public.email_digest_queue (flushed_at)
  where flushed_at is not null;

alter table public.email_digest_queue enable row level security;

revoke all on table public.email_digest_queue from public, anon, authenticated;

-- No policies for anon/authenticated — only service_role (bypasses RLS) may access.
