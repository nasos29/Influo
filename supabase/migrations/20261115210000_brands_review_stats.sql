-- Additive: denormalized creator→brand review stats for directory / brand cards.
-- Do NOT apply to production from this PR; ship with deploy when ready.
-- NOTE: brands uses column-level privileges — new columns need explicit
-- SELECT for anon/authenticated (see 20261115220000_brands_review_stats_select_grants).

alter table public.brands
  add column if not exists avg_rating numeric(3, 2) default 0;

alter table public.brands
  add column if not exists total_reviews integer default 0;

comment on column public.brands.avg_rating is
  'Average rating from creator→brand reviews (influencer_reviews.project_type = __of_brand__).';

comment on column public.brands.total_reviews is
  'Count of verified creator→brand reviews.';

-- Idempotent: safe if already granted by the hotfix migration.
grant select (avg_rating, total_reviews) on table public.brands to anon, authenticated;
