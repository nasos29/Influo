-- Portfolio media: direct uploads (chunked, resumable) + queued link downloads.
-- Additive only: new bucket, new tables, new trigger. No data rewrite, no change to existing rows.
-- Existing creators are NOT queued (the trigger fires only when videos change).

-- Private staging bucket for upload chunks (originals never public). Chunks are deleted after processing.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('creator-uploads', 'creator-uploads', false, 16777216, NULL)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.creator_media_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  created_by uuid NULL,
  media_type text NOT NULL CHECK (media_type IN ('video', 'photo')),
  mime_type text NOT NULL,
  file_name text NULL,
  total_bytes bigint NOT NULL CHECK (total_bytes > 0),
  chunk_bytes integer NOT NULL CHECK (chunk_bytes > 0),
  received_bytes bigint NOT NULL DEFAULT 0,
  client_duration_ms integer NULL,
  status text NOT NULL DEFAULT 'uploading'
    CHECK (status IN ('uploading', 'uploaded', 'processing', 'ready', 'failed', 'cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  error text NULL,
  folder_path text NULL,
  portfolio_url text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_media_uploads_influencer_idx
  ON public.creator_media_uploads (influencer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS creator_media_uploads_status_idx
  ON public.creator_media_uploads (status, updated_at);

COMMENT ON TABLE public.creator_media_uploads IS
  'Direct portfolio uploads. Chunks live in creator-uploads/uploads/<influencer>/<id>/; the media worker encodes into creator-videos and appends to influencers.videos.';

ALTER TABLE public.creator_media_uploads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.creator_media_uploads FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.creator_media_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  source_url text NOT NULL,
  source_url_key text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'done', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (influencer_id, source_url_key)
);

CREATE INDEX IF NOT EXISTS creator_media_jobs_status_idx
  ON public.creator_media_jobs (status, created_at);

COMMENT ON TABLE public.creator_media_jobs IS
  'Queue: TikTok/Instagram portfolio links to download + encode into the self-hosted portfolio (YouTube stays embed).';

ALTER TABLE public.creator_media_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.creator_media_jobs FROM anon, authenticated;

-- Queue TikTok/Instagram portfolio links when a creator signs up or adds links.
CREATE OR REPLACE FUNCTION public.queue_portfolio_link_downloads()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u text;
  k text;
BEGIN
  IF NEW.videos IS NULL OR jsonb_typeof(NEW.videos) <> 'array' THEN
    RETURN NEW;
  END IF;
  FOR u IN SELECT jsonb_array_elements_text(NEW.videos) LOOP
    u := btrim(u);
    IF u !~* '^https?://([a-z0-9-]+\.)*(tiktok\.com|instagram\.com|instagr\.am)/' THEN
      CONTINUE;
    END IF;
    -- Dedupe key: no scheme/www, no query/hash, no trailing slash, lowercase.
    k := lower(regexp_replace(regexp_replace(split_part(split_part(u, '#', 1), '?', 1), '/+$', ''), '^https?://(www\.)?', ''));
    INSERT INTO public.creator_media_jobs (influencer_id, source_url, source_url_key)
    VALUES (NEW.id, u, k)
    ON CONFLICT (influencer_id, source_url_key) DO UPDATE
      SET status = 'queued', attempts = 0, error = NULL, updated_at = now()
      WHERE public.creator_media_jobs.status = 'failed'
        AND public.creator_media_jobs.updated_at < now() - interval '1 day';
  END LOOP;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block a signup or profile save because of the media queue.
  RAISE WARNING 'queue_portfolio_link_downloads: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_influencers_queue_portfolio_links_ins ON public.influencers;
CREATE TRIGGER trg_influencers_queue_portfolio_links_ins
  AFTER INSERT ON public.influencers
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_portfolio_link_downloads();

DROP TRIGGER IF EXISTS trg_influencers_queue_portfolio_links_upd ON public.influencers;
CREATE TRIGGER trg_influencers_queue_portfolio_links_upd
  AFTER UPDATE OF videos ON public.influencers
  FOR EACH ROW
  WHEN (NEW.videos IS DISTINCT FROM OLD.videos)
  EXECUTE FUNCTION public.queue_portfolio_link_downloads();

COMMENT ON FUNCTION public.queue_portfolio_link_downloads() IS
  'Queues new TikTok/Instagram portfolio links into creator_media_jobs. Idempotent; failed jobs re-queue after 1 day when the link is saved again.';

-- Atomic append used by the media worker (service role only). The 6-item trigger still applies.
CREATE OR REPLACE FUNCTION public.append_portfolio_item(p_influencer_id uuid, p_url text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_videos jsonb;
BEGIN
  SELECT videos INTO current_videos FROM public.influencers WHERE id = p_influencer_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'missing';
  END IF;
  IF current_videos IS NULL OR jsonb_typeof(current_videos) <> 'array' THEN
    current_videos := '[]'::jsonb;
  END IF;
  IF current_videos @> jsonb_build_array(p_url) THEN
    RETURN 'exists';
  END IF;
  IF jsonb_array_length(current_videos) >= 6 THEN
    RETURN 'full';
  END IF;
  UPDATE public.influencers SET videos = current_videos || jsonb_build_array(p_url) WHERE id = p_influencer_id;
  RETURN 'added';
END;
$$;

REVOKE ALL ON FUNCTION public.append_portfolio_item(uuid, text) FROM public, anon, authenticated;
