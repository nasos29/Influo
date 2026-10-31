-- Nightly portfolio video playability checker (checkVideoPlayable).
-- Run this yourself in the Supabase SQL editor. The app does not apply it.
--
-- A link is HIDDEN (not deleted) only after 2 consecutive unplayable nights.
-- Technical failures stay "unchecked" and never hide a link.
-- TikTok short links that redirect to the homepage are unchecked (not broken).
-- Hidden URLs stay in influencers.videos; visibility uses hidden_videos jsonb.

ALTER TABLE public.influencers
  ADD COLUMN IF NOT EXISTS hidden_videos jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.influencers.hidden_videos IS
  'Portfolio URLs hidden from the public profile after consecutive unplayable checks. Shape: [{url, reason, hidden_at}]. videos column is never mutated by the cron.';

CREATE TABLE IF NOT EXISTS public.portfolio_video_strikes (
  influencer_id uuid NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  url text NOT NULL,
  consecutive_unplayable integer NOT NULL DEFAULT 0,
  last_reason text,
  last_checked_at timestamptz,
  PRIMARY KEY (influencer_id, url)
);

CREATE TABLE IF NOT EXISTS public.portfolio_video_check_state (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cursor_influencer_id uuid,
  cursor_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.portfolio_video_check_state (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.portfolio_video_strikes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_video_check_state ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.portfolio_video_strikes FROM anon, authenticated;
REVOKE ALL ON TABLE public.portfolio_video_check_state FROM anon, authenticated;

COMMENT ON TABLE public.portfolio_video_strikes IS
  'Per-URL consecutive unplayable streak for the nightly portfolio video cron. Service role only.';
COMMENT ON TABLE public.portfolio_video_check_state IS
  'Cursor so the nightly portfolio video cron can resume across nights. Service role only.';
