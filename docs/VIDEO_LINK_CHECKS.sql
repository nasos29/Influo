-- Nightly dead-link checker. Run this yourself in the Supabase SQL editor.
-- The app does not apply it.
--
-- video_link_checks remembers the last result per profile URL.
-- A link is removed only after two "missing" results at least 72 hours apart.
-- video_link_removals is the restore log. To put a link back:
--
--   update public.influencers
--   set videos = videos || jsonb_build_array(r.url)
--   from public.video_link_removals r
--   where influencers.id = r.influencer_id
--     and r.id = '<removal row id>';
--
-- If videos is a text[] column rather than jsonb, use array_append instead.
-- Only that URL is removed from the profile. Nothing else is edited,
-- except the matching video_thumbnails key for the same URL.

CREATE TABLE IF NOT EXISTS public.video_link_checks (
  influencer_id uuid NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  url text NOT NULL,
  platform text NOT NULL,
  missing_count integer NOT NULL DEFAULT 0,
  first_missing_at timestamptz,
  last_checked_at timestamptz,
  last_status text,
  last_http_status integer,
  last_detail text,
  PRIMARY KEY (influencer_id, url)
);

CREATE TABLE IF NOT EXISTS public.video_link_removals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  display_name text,
  url text NOT NULL,
  platform text NOT NULL,
  removed_at timestamptz NOT NULL DEFAULT now(),
  http_status integer,
  detail text
);

CREATE INDEX IF NOT EXISTS video_link_removals_removed_at
  ON public.video_link_removals (removed_at DESC);

CREATE TABLE IF NOT EXISTS public.video_link_check_state (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cursor_influencer_id uuid,
  cursor_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.video_link_check_state (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.video_link_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_link_removals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_link_check_state ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.video_link_checks FROM anon, authenticated;
REVOKE ALL ON TABLE public.video_link_removals FROM anon, authenticated;
REVOKE ALL ON TABLE public.video_link_check_state FROM anon, authenticated;

COMMENT ON TABLE public.video_link_checks IS
  'Per-URL check state for the nightly dead video-link cron. Service role only.';
COMMENT ON TABLE public.video_link_removals IS
  'Links removed from influencers.videos. Use the URL here to restore one.';
