-- NOT APPLIED: awaiting approval.
-- Optional number of creator slots per campaign. NULL = no limit (all existing campaigns).
alter table public.brand_campaigns
  add column if not exists slots integer check (slots is null or (slots > 0 and slots <= 500));
