-- English translations for brand-authored campaign copy.
-- Shown on /en and when the UI language is English.

ALTER TABLE public.brand_campaigns
  ADD COLUMN IF NOT EXISTS title_en text,
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS deliverables_en text;

COMMENT ON COLUMN public.brand_campaigns.title_en IS 'English translation of title; shown when UI language is EN.';
COMMENT ON COLUMN public.brand_campaigns.description_en IS 'English translation of description; shown when UI language is EN.';
COMMENT ON COLUMN public.brand_campaigns.deliverables_en IS 'English translation of deliverables; shown when UI language is EN.';
