-- Portfolio link jobs: skip self-hosted URLs, retry with backoff, cleanup removed links.

ALTER TABLE public.creator_media_jobs
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz NULL;

COMMENT ON COLUMN public.creator_media_jobs.next_retry_at IS
  'When status is queued after a failure, do not claim the job before this time (backoff).';

CREATE OR REPLACE FUNCTION public.portfolio_link_source_key(u text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(
    regexp_replace(
      regexp_replace(split_part(split_part(btrim(u), '#', 1), '?', 1), '/+$', ''),
      '^https?://(www\.)?',
      ''
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_self_hosted_portfolio_url(u text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    btrim(u) ~* '/creators/[0-9a-f-]{36}/portfolio/'
    OR btrim(u) ~* '/storage/v1/object/public/[^/]+/creators/[0-9a-f-]{36}/portfolio/';
$$;

CREATE OR REPLACE FUNCTION public.is_portfolio_still_image_url(u text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    btrim(u) ~* '/photo\.webp(\?|#|$)'
    OR btrim(u) ~* '\.(jpe?g|png|gif|webp|bmp|heic|heif|svg)(\?|#|$)';
$$;

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

  DELETE FROM public.creator_media_jobs j
  WHERE j.influencer_id = NEW.id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(NEW.videos) AS v(url)
      WHERE public.portfolio_link_source_key(v.url) = j.source_url_key
    );

  FOR u IN SELECT jsonb_array_elements_text(NEW.videos) LOOP
    u := btrim(u);
    IF u = '' THEN
      CONTINUE;
    END IF;
    IF public.is_self_hosted_portfolio_url(u) OR public.is_portfolio_still_image_url(u) THEN
      CONTINUE;
    END IF;
    IF u !~* '^https?://([a-z0-9-]+\.)*(tiktok\.com|instagram\.com|instagr\.am)/' THEN
      CONTINUE;
    END IF;
    k := public.portfolio_link_source_key(u);
    INSERT INTO public.creator_media_jobs (influencer_id, source_url, source_url_key)
    VALUES (NEW.id, u, k)
    ON CONFLICT (influencer_id, source_url_key) DO UPDATE
      SET source_url = EXCLUDED.source_url,
          status = 'queued',
          attempts = 0,
          error = NULL,
          next_retry_at = NULL,
          updated_at = now()
      WHERE public.creator_media_jobs.status = 'failed';
  END LOOP;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'queue_portfolio_link_downloads: %', SQLERRM;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.queue_portfolio_link_downloads() IS
  'Queues new TikTok/Instagram portfolio links. Skips URLs already on our media storage or still images. Removes jobs for deleted links.';