-- Add birth_date column to influencers table for age filter in directory
-- Run this in Supabase SQL Editor before using the new signup field and age filter.

ALTER TABLE influencers
ADD COLUMN IF NOT EXISTS birth_date DATE;

COMMENT ON COLUMN influencers.birth_date IS 'Date of birth; used to compute age for directory filter.';
