-- Additive: denormalized creator→brand review stats for directory / brand cards.
-- Do NOT apply to production from this PR; ship with deploy when ready.

alter table public.brands
  add column if not exists avg_rating numeric(3, 2) default 0;

alter table public.brands
  add column if not exists total_reviews integer default 0;

comment on column public.brands.avg_rating is
  'Average rating from creator→brand reviews (influencer_reviews.project_type = __of_brand__).';

comment on column public.brands.total_reviews is
  'Count of verified creator→brand reviews.';
