-- Migrate old "Beauty" category to "Beauty & Makeup"
-- This script updates influencers who have "Beauty" in their category field
-- and replaces it with "Beauty & Makeup"

-- First, let's see how many influencers have "Beauty" category
-- SELECT COUNT(*) FROM influencers WHERE category ILIKE '%Beauty%';

-- Update influencers who have only "Beauty" category
UPDATE influencers 
SET category = 'Beauty & Makeup'
WHERE category = 'Beauty' OR category ILIKE 'Beauty';

-- Update influencers who have "Beauty" as part of comma-separated categories
-- Example: "Beauty, Lifestyle" -> "Beauty & Makeup, Lifestyle"
UPDATE influencers 
SET category = REPLACE(category, 'Beauty', 'Beauty & Makeup')
WHERE category ILIKE '%Beauty%' 
  AND category NOT ILIKE '%Beauty & Makeup%'
  AND category != 'Beauty & Makeup';

-- Also handle case variations (BEAUTY, beauty, etc.)
UPDATE influencers 
SET category = REPLACE(REPLACE(REPLACE(REPLACE(
  category, 
  'BEAUTY', 'Beauty & Makeup'),
  'beauty', 'Beauty & Makeup'),
  'Beauty,', 'Beauty & Makeup,'),
  ',Beauty', ',Beauty & Makeup')
WHERE category ILIKE '%beauty%' 
  AND category NOT ILIKE '%Beauty & Makeup%'
  AND category != 'Beauty & Makeup';

-- Clean up any duplicate "Beauty & Makeup" entries (if someone had both)
-- This regex-like replacement is complex in SQL, so we'll handle it more carefully
UPDATE influencers 
SET category = REPLACE(category, 'Beauty & Makeup, Beauty & Makeup', 'Beauty & Makeup')
WHERE category LIKE '%Beauty & Makeup, Beauty & Makeup%';

UPDATE influencers 
SET category = REPLACE(category, 'Beauty & Makeup,Beauty & Makeup', 'Beauty & Makeup')
WHERE category LIKE '%Beauty & Makeup,Beauty & Makeup%';
