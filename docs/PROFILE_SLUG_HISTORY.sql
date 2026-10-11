-- Retired public profile slugs.
-- Run this yourself in the Supabase SQL editor. The app does not apply it.
--
-- When an influencer changes /in/<slug> from the dashboard (Εργαλεία),
-- the previous slug is stored here and /in/<old> answers 308 to the current URL.
-- Until this table exists, the app refuses a slug change so the old link is not orphaned.
-- First-time slug assignment (empty profile_slug) does not need this table.

CREATE TABLE IF NOT EXISTS public.influencer_slug_history (
  slug text PRIMARY KEY,
  influencer_id uuid NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT influencer_slug_history_slug_format CHECK (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    AND char_length(slug) BETWEEN 2 AND 40
  )
);

CREATE INDEX IF NOT EXISTS influencer_slug_history_influencer_id
  ON public.influencer_slug_history (influencer_id);

COMMENT ON TABLE public.influencer_slug_history IS
  'Previous /in/ slugs. The site 308s these to the influencer''s current profile_slug.';

ALTER TABLE public.influencer_slug_history ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.influencer_slug_history FROM anon, authenticated;
