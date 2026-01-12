-- Fix gender constraint to allow "Other" option
-- Run this SQL in Supabase if you get the error: "violates check constraint influencers_gender_check"

-- Step 1: Check current constraint (for reference)
-- SELECT conname, pg_get_constraintdef(oid) 
-- FROM pg_constraint 
-- WHERE conrelid = 'influencers'::regclass AND conname = 'influencers_gender_check';

-- Step 2: Drop the existing constraint (if it exists)
-- Try different possible constraint names
ALTER TABLE influencers DROP CONSTRAINT IF EXISTS influencers_gender_check;
ALTER TABLE influencers DROP CONSTRAINT IF EXISTS gender_check;
ALTER TABLE influencers DROP CONSTRAINT IF EXISTS check_gender;

-- Step 3: Check if there are any invalid gender values and fix them
UPDATE influencers 
SET gender = 'Female' 
WHERE gender IS NOT NULL 
  AND gender NOT IN ('Female', 'Male', 'Other');

-- Step 4: Add new constraint that allows Female, Male, and Other (and NULL)
ALTER TABLE influencers ADD CONSTRAINT influencers_gender_check 
  CHECK (gender IS NULL OR gender IN ('Female', 'Male', 'Other'));

-- Verify the constraint was created
-- SELECT conname, pg_get_constraintdef(oid) 
-- FROM pg_constraint 
-- WHERE conrelid = 'influencers'::regclass AND conname = 'influencers_gender_check';
