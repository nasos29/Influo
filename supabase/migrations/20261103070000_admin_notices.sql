-- Admin in-app notices (campaign applications and other admin events). New table only.
create table if not exists public.admin_notices (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  title text not null,
  body text,
  url text,
  dedupe_key text unique,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists admin_notices_created_idx on public.admin_notices (created_at desc);
alter table public.admin_notices enable row level security;
-- No policies: only the service role (server API) can read/write.
