-- Migration script to update "Beauty" category to "Beauty & Makeup"
-- This script updates influencers who have "Beauty" or "BEAUTY" in their category field
-- to "Beauty & Makeup" instead.

-- First, let's see what we're working with
-- SELECT id, display_name, category FROM influencers WHERE category ILIKE '%Beauty%' AND category NOT ILIKE '%Makeup%';

-- Update influencers where category is exactly "Beauty"
UPDATE influencers
SET category = 'Beauty & Makeup'
WHERE category = 'Beauty';

-- Update influencers where category contains "Beauty" but not "Makeup" (comma-separated)
-- This handles cases like "Beauty, Lifestyle" or "Lifestyle, Beauty"
UPDATE influencers
SET category = CASE
    -- If category starts with "Beauty,"
    WHEN category LIKE 'Beauty,%' THEN REPLACE(category, 'Beauty,', 'Beauty & Makeup,')
    -- If category ends with ",Beauty"
    WHEN category LIKE '%,Beauty' THEN REPLACE(category, ',Beauty', ',Beauty & Makeup')
    -- If category contains ",Beauty,"
    WHEN category LIKE '%,Beauty,%' THEN REPLACE(category, ',Beauty,', ',Beauty & Makeup,')
    -- If category is just "Beauty" (should have been caught above, but just in case)
    WHEN category = 'Beauty' THEN 'Beauty & Makeup'
    ELSE category
END
WHERE category ILIKE '%Beauty%' 
  AND category NOT ILIKE '%Makeup%'
  AND category NOT ILIKE '%Beauty & Makeup%';

-- Also handle uppercase "BEAUTY"
UPDATE influencers
SET category = CASE
    -- If category starts with "BEAUTY,"
    WHEN category LIKE 'BEAUTY,%' THEN REPLACE(category, 'BEAUTY,', 'Beauty & Makeup,')
    -- If category ends with ",BEAUTY"
    WHEN category LIKE '%,BEAUTY' THEN REPLACE(category, ',BEAUTY', ',Beauty & Makeup')
    -- If category contains ",BEAUTY,"
    WHEN category LIKE '%,BEAUTY,%' THEN REPLACE(category, ',BEAUTY,', ',Beauty & Makeup,')
    -- If category is just "BEAUTY"
    WHEN category = 'BEAUTY' THEN 'Beauty & Makeup'
    ELSE category
END
WHERE category ILIKE '%BEAUTY%' 
  AND category NOT ILIKE '%Makeup%'
  AND category NOT ILIKE '%Beauty & Makeup%';

-- Verify the changes
-- SELECT id, display_name, category FROM influencers WHERE category ILIKE '%Beauty%';
