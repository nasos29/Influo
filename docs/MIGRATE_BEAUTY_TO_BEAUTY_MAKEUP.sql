-- Migrate old "Beauty" category to "Beauty & Makeup"
-- This script updates influencers who have "Beauty" in their category field
-- and replaces it with "Beauty & Makeup", handling comma-separated categories

-- First, check how many influencers have "Beauty" category (uncomment to run)
-- SELECT id, display_name, category FROM influencers WHERE category ILIKE '%Beauty%' AND category NOT ILIKE '%Beauty & Makeup%';

-- Update influencers who have only "Beauty" category (exact match, case-insensitive)
UPDATE influencers 
SET category = 'Beauty & Makeup'
WHERE TRIM(category) ILIKE 'Beauty'
   OR TRIM(category) ILIKE 'BEAUTY'
   OR TRIM(category) ILIKE 'beauty';

-- Update influencers who have "Beauty" at the start of comma-separated categories
-- Example: "Beauty, Lifestyle" -> "Beauty & Makeup, Lifestyle"
UPDATE influencers 
SET category = 'Beauty & Makeup' || SUBSTRING(category FROM POSITION(',' IN category))
WHERE category ILIKE 'Beauty,%'
   OR category ILIKE 'BEAUTY,%'
   OR category ILIKE 'beauty,%'
  AND category NOT ILIKE '%Beauty & Makeup%';

-- Update influencers who have "Beauty" in the middle or end of comma-separated categories
-- Example: "Lifestyle, Beauty" -> "Lifestyle, Beauty & Makeup"
-- Example: "Fashion, Beauty, Travel" -> "Fashion, Beauty & Makeup, Travel"
UPDATE influencers 
SET category = REPLACE(
  REPLACE(
    REPLACE(
      REPLACE(category, ', Beauty,', ', Beauty & Makeup,'),
      ', Beauty', ', Beauty & Makeup'
    ),
    'Beauty,', 'Beauty & Makeup,'
  ),
  'BEAUTY', 'Beauty & Makeup'
)
WHERE (category ILIKE '%, Beauty,%' 
    OR category ILIKE '%, Beauty'
    OR category ILIKE 'Beauty,%'
    OR category ILIKE '%BEAUTY%')
  AND category NOT ILIKE '%Beauty & Makeup%';

-- Clean up any duplicate "Beauty & Makeup" entries (if someone had both)
UPDATE influencers 
SET category = REPLACE(category, 'Beauty & Makeup, Beauty & Makeup', 'Beauty & Makeup')
WHERE category LIKE '%Beauty & Makeup, Beauty & Makeup%';

UPDATE influencers 
SET category = REPLACE(category, 'Beauty & Makeup,Beauty & Makeup', 'Beauty & Makeup')
WHERE category LIKE '%Beauty & Makeup,Beauty & Makeup%';

-- Trim any extra spaces
UPDATE influencers 
SET category = TRIM(REPLACE(category, '  ', ' '))
WHERE category LIKE '%  %';
