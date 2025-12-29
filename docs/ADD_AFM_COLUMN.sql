-- Add afm column to brands table
-- Step 1: Add column as nullable first
ALTER TABLE brands ADD COLUMN IF NOT EXISTS afm TEXT;

-- Step 2: If there are existing rows, set a default value (optional)
-- UPDATE brands SET afm = '' WHERE afm IS NULL;

-- Step 3: Make it NOT NULL (only if you want to enforce it)
-- ALTER TABLE brands ALTER COLUMN afm SET NOT NULL;

