-- Applied to Supabase 2026-11-05 (approved).
alter table public.brand_campaigns add column if not exists title_en text;
alter table public.brand_campaigns add column if not exists description_en text;
alter table public.brand_campaigns add column if not exists deliverables_en text;
