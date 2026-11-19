-- Durable transactional email log (no raw addresses).
create table if not exists public.email_log (
  id bigserial primary key,
  sent_at timestamptz not null default now(),
  type text not null,
  ok boolean not null default false,
  provider text not null default 'resend',
  recipient_id uuid null,
  deal_ref text null,
  party text null
);

create index if not exists email_log_sent_at_idx on public.email_log (sent_at desc);
create index if not exists email_log_type_sent_at_idx on public.email_log (type, sent_at desc);

comment on table public.email_log is 'Transactional send outcomes; optional deal_ref + party; never stores email addresses.';

alter table public.email_log enable row level security;
revoke all on table public.email_log from public, anon, authenticated;