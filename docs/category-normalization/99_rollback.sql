-- Rollback για το 01_normalize_category_values.sql.
-- Επαναφέρει μόνο τις γραμμές που άλλαξε το 01, από τον πίνακα backup.
-- Αν το 01 δεν άλλαξε καμία γραμμή, αυτό δεν πειράζει δεδομένα και μετά σβήνει το backup.

BEGIN;
SET LOCAL lock_timeout = '15s';
SET LOCAL statement_timeout = '180s';

UPDATE public.influencers i
SET category = b.old_value
FROM public.category_value_backup_20261011 b
WHERE b.src = 'influencers'
  AND b.column_name = 'category'
  AND b.row_id = i.id;

UPDATE public.brands br
SET industry = b.old_value
FROM public.category_value_backup_20261011 b
WHERE b.src = 'brands'
  AND b.column_name = 'industry'
  AND b.row_id = br.id;

UPDATE public.brand_campaigns c
SET category = b.old_value
FROM public.category_value_backup_20261011 b
WHERE b.src = 'brand_campaigns'
  AND b.column_name = 'category'
  AND b.row_id = c.id;

DROP TABLE IF EXISTS public.category_value_backup_20261011;
DROP FUNCTION IF EXISTS public.normalize_stored_categories(text);

COMMIT;
