-- Add bio_en column to influencers table for English bio translation
-- This allows admins to provide English translations of influencer bios
-- When users switch language to English, the English bio will be displayed instead of the Greek one

ALTER TABLE influencers 
ADD COLUMN IF NOT EXISTS bio_en TEXT;

-- Add comment to document the column
COMMENT ON COLUMN influencers.bio_en IS 'English translation of the bio field. Displayed when user language is set to English.';
