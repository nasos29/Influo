-- Durable email send audit (no raw addresses). Service role + server writes only.

create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  email_type text not null,
  ok boolean not null default false,
  influencer_id uuid references public.influencers(id) on delete set null,
  meta jsonb,
  created_at timestamptz not null default now(),
  constraint email_log_type_len check (char_length(email_type) between 1 and 64)
);

create index if not exists email_log_type_created_idx on public.email_log (email_type, created_at desc);
create index if not exists email_log_influencer_created_idx on public.email_log (influencer_id, created_at desc);

comment on table public.email_log is
  'Server-side log of transactional email attempts (type, ok, optional influencer_id + meta).';

alter table public.email_log enable row level security;
-- No policies: service role only.