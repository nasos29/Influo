-- Fix gender constraint to allow "Other" option
-- Run this SQL in Supabase if you get the error: "violates check constraint influencers_gender_check"

-- First, drop the existing constraint (if it exists)
ALTER TABLE influencers DROP CONSTRAINT IF EXISTS influencers_gender_check;

-- Add new constraint that allows Female, Male, and Other
ALTER TABLE influencers ADD CONSTRAINT influencers_gender_check 
  CHECK (gender IS NULL OR gender IN ('Female', 'Male', 'Other'));

-- If the above doesn't work, try this alternative:
-- ALTER TABLE influencers ADD CONSTRAINT influencers_gender_check 
--   CHECK (gender IN ('Female', 'Male', 'Other'));
