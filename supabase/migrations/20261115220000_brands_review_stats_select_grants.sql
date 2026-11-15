-- Hotfix 2026-11-15: brands directory went empty because BrandsDirectory
-- selects avg_rating/total_reviews, and those columns (added by
-- 20261115210000_brands_review_stats) inherited INSERT/UPDATE/REFERENCES
-- for anon/authenticated but not SELECT (column-level privileges on brands).
-- PostgREST then returns 42501 "permission denied for table brands" and the
-- client emptied the list. Additive SELECT grants only.

grant select (avg_rating, total_reviews) on table public.brands to anon, authenticated;
