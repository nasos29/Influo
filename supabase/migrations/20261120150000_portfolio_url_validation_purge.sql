-- Portfolio URL allowlist (TikTok / Instagram / YouTube / self-hosted) and orphan portfolio media purge.

CREATE OR REPLACE FUNCTION public.is_self_hosted_portfolio_url(u text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  t text;
  base text;
  rest text;
BEGIN
  t := btrim(COALESCE(u, ''));
  IF t = '' THEN
    RETURN false;
  END IF;
  IF t ~* '^https?://[^/]+/storage/v1/object/public/[^/]+/creators/[0-9a-f-]{36}/portfolio/' THEN
    RETURN true;
  END IF;
  SELECT nullif(btrim(trim(both '"' FROM s.value::text)), '')
    INTO base
  FROM public.site_settings s
  WHERE s.key = 'media_public_base_url'
  LIMIT 1;
  IF base IS NOT NULL AND base <> '' THEN
    base := lower(regexp_replace(base, '/+$', ''));
    IF length(t) > length(base) AND lower(left(t, length(base))) = base AND substring(t, length(base) + 1, 1) = '/' THEN
      rest := substring(t FROM length(base) + 2);
      IF rest ~* '^creators/[0-9a-f-]{36}/portfolio/' THEN
        RETURN true;
      END IF;
    END IF;
  END IF;
  RETURN false;
END;
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
    ON CONFLICT (influencer_id, source_url_key) DO NOTHING;
  END LOOP;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'queue_portfolio_link_downloads: %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.portfolio_source_norm(u text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  t text;
BEGIN
  t := btrim(split_part(split_part(COALESCE(u, ''), '#', 1), '?', 1));
  IF t = '' THEN
    RETURN '';
  END IF;
  IF t !~* '^https?://' THEN
    t := 'https://' || t;
  END IF;
  t := lower(regexp_replace(t, '^https?://(www\.)?', 'https://', 'i'));
  t := regexp_replace(t, '/+$', '');
  RETURN t;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_allowed_portfolio_url(u text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  t text;
BEGIN
  t := btrim(COALESCE(u, ''));
  IF t = '' THEN
    RETURN false;
  END IF;
  IF public.is_self_hosted_portfolio_url(t) THEN
    RETURN true;
  END IF;
  IF public.is_portfolio_still_image_url(t) THEN
    RETURN false;
  END IF;
  IF t ~* '(^|[/.])(facebook\.com|fb\.com|fb\.watch)([/?#:]|$)' THEN
    RETURN false;
  END IF;
  RETURN t ~* '^https?://([a-z0-9-]+\.)*(tiktok\.com|instagram\.com|instagr\.am|youtube\.com|youtu\.be|vm\.tiktok\.com|vt\.tiktok\.com)/';
END;
$$;

COMMENT ON FUNCTION public.is_allowed_portfolio_url(text) IS
  'Portfolio slots: TikTok, Instagram, YouTube links, or URLs already on our creator-videos portfolio paths.';

CREATE OR REPLACE FUNCTION public.enforce_portfolio_url_allowlist()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  u text;
BEGIN
  IF NEW.videos IS NULL OR jsonb_typeof(NEW.videos) <> 'array' THEN
    RETURN NEW;
  END IF;
  FOR u IN SELECT jsonb_array_elements_text(NEW.videos) LOOP
    u := btrim(u);
    IF u = '' THEN
      CONTINUE;
    END IF;
    IF NOT public.is_allowed_portfolio_url(u) THEN
      RAISE EXCEPTION 'portfolio_url_not_allowed'
        USING HINT = 'Use TikTok, Instagram, YouTube, or upload the file directly.',
              ERRCODE = 'check_violation';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_influencers_portfolio_url_allowlist ON public.influencers;
CREATE TRIGGER trg_influencers_portfolio_url_allowlist
  BEFORE INSERT OR UPDATE OF videos ON public.influencers
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_portfolio_url_allowlist();

CREATE OR REPLACE FUNCTION public.purge_dropped_portfolio_media()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_rec record;
  dropped_url text;
  folder text;
  prefix text;
BEGIN
  IF NEW.videos IS NULL OR jsonb_typeof(NEW.videos) <> 'array' THEN
    RETURN NEW;
  END IF;

  FOR row_rec IN
    SELECT cm.*
    FROM public.creator_media cm
    WHERE cm.influencer_id = NEW.id
      AND cm.kind = 'portfolio'
  LOOP
    IF row_rec.source_video_id IS NOT NULL AND row_rec.source_video_id LIKE 'upload-%' THEN
      IF EXISTS (
        SELECT 1
        FROM public.creator_media_uploads u
        WHERE u.influencer_id = NEW.id
          AND ('upload-' || u.id::text) = row_rec.source_video_id
          AND u.status IN ('uploaded', 'processing')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(NEW.videos) AS v(url)
        WHERE btrim(v.url) <> ''
          AND (
            v.url ILIKE '%' || row_rec.folder_path || '%'
            OR public.portfolio_source_norm(btrim(v.url)) = lower(row_rec.source_url_norm)
          )
      ) THEN
        CONTINUE;
      END IF;
    END IF;
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(NEW.videos) AS v(url)
      WHERE btrim(v.url) <> ''
        AND public.portfolio_source_norm(btrim(v.url)) = lower(row_rec.source_url_norm)
    ) THEN
      CONTINUE;
    END IF;
    IF NOT EXISTS (
    SELECT 1
    FROM public.creator_media other
    WHERE other.influencer_id = NEW.id
      AND other.folder_path = row_rec.folder_path
      AND other.id <> row_rec.id
  ) THEN
    prefix := rtrim(row_rec.folder_path, '/') || '/';
    IF prefix <> '/' THEN
      INSERT INTO public.creator_storage_purge (influencer_id, prefix)
      VALUES (NEW.id, prefix);
    END IF;
    DELETE FROM public.creator_media WHERE id = row_rec.id;
  ELSE
    DELETE FROM public.creator_media WHERE id = row_rec.id;
  END IF;
  END LOOP;

  IF TG_OP = 'UPDATE' AND OLD.videos IS NOT NULL AND jsonb_typeof(OLD.videos) = 'array' THEN
    FOR dropped_url IN
      SELECT btrim(ou.url)
      FROM jsonb_array_elements_text(OLD.videos) AS ou(url)
      WHERE btrim(ou.url) <> ''
        AND NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(NEW.videos) AS nv(url)
          WHERE public.portfolio_source_norm(btrim(nv.url)) = public.portfolio_source_norm(btrim(ou.url))
        )
    LOOP
      IF NOT public.is_self_hosted_portfolio_url(dropped_url) THEN
        CONTINUE;
      END IF;
      folder := substring(dropped_url from 'creators/[0-9a-f-]{36}/portfolio/[^/]+');
      IF folder IS NULL OR folder = '' THEN
        CONTINUE;
      END IF;
      IF EXISTS (
        SELECT 1 FROM public.creator_media cm
        WHERE cm.influencer_id = NEW.id AND cm.folder_path = folder
      ) THEN
        CONTINUE;
      END IF;
      prefix := rtrim(folder, '/') || '/';
      INSERT INTO public.creator_storage_purge (influencer_id, prefix)
      SELECT NEW.id, prefix
      WHERE NOT EXISTS (
        SELECT 1 FROM public.creator_storage_purge q
        WHERE q.influencer_id = NEW.id
          AND q.prefix = prefix
          AND q.processed_at IS NULL
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'purge_dropped_portfolio_media: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_influencers_purge_dropped_portfolio ON public.influencers;
CREATE TRIGGER trg_influencers_purge_dropped_portfolio
  AFTER INSERT OR UPDATE OF videos ON public.influencers
  FOR EACH ROW
  EXECUTE FUNCTION public.purge_dropped_portfolio_media();