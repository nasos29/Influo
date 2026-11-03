-- Applied to Supabase 2026-11-03 (approved).
alter table public.brand_campaigns add column if not exists requires_presence boolean not null default false;
