-- Extend creator_media_jobs enqueue: shared helper, collab URLs, vm.tiktok short links.

CREATE OR REPLACE FUNCTION public.is_hostable_ig_tt_url(u text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    btrim(COALESCE(u, '')) ~* '^https?://([a-z0-9-]+\.)*(tiktok\.com|instagram\.com|instagr\.am|vm\.tiktok\.com|vt\.tiktok\.com)/'
    AND NOT public.is_self_hosted_portfolio_url(u)
    AND NOT public.is_portfolio_still_image_url(u);
$$;

CREATE OR REPLACE FUNCTION public.enqueue_creator_media_job(p_influencer_id uuid, p_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u text;
  k text;
  job public.creator_media_jobs%ROWTYPE;
BEGIN
  u := btrim(COALESCE(p_url, ''));
  IF u = '' OR p_influencer_id IS NULL THEN
    RETURN;
  END IF;
  IF NOT public.is_hostable_ig_tt_url(u) THEN
    RETURN;
  END IF;
  k := public.portfolio_link_source_key(u);

  SELECT * INTO job
  FROM public.creator_media_jobs j
  WHERE j.influencer_id = p_influencer_id AND j.source_url_key = k
  LIMIT 1;

  IF FOUND THEN
    IF job.status IN ('queued', 'processing', 'done') THEN
      RETURN;
    END IF;
    IF job.status = 'failed' AND job.updated_at >= now() - interval '1 day' THEN
      RETURN;
    END IF;
    UPDATE public.creator_media_jobs
    SET source_url = u,
        status = 'queued',
        attempts = 0,
        error = NULL,
        next_retry_at = NULL,
        updated_at = now()
    WHERE id = job.id;
    RETURN;
  END IF;

  INSERT INTO public.creator_media_jobs (influencer_id, source_url, source_url_key)
  VALUES (p_influencer_id, u, k)
  ON CONFLICT (influencer_id, source_url_key) DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'enqueue_creator_media_job: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION public.enqueue_creator_media_job(uuid, text) IS
  'Idempotent TikTok/Instagram download queue. Skips ready jobs; failed rows re-queue only after 1 day.';

-- Portfolio trigger: delegate to shared enqueue helper.
CREATE OR REPLACE FUNCTION public.queue_portfolio_link_downloads()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u text;
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
    PERFORM public.enqueue_creator_media_job(NEW.id, u);
  END LOOP;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'queue_portfolio_link_downloads: %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_proposal_collab_media()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enqueue_creator_media_job(NEW.influencer_id, NEW.published_post_url);
  PERFORM public.enqueue_creator_media_job(NEW.influencer_id, NEW.delivery_proof_url);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'queue_proposal_collab_media: %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_application_collab_media()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.enqueue_creator_media_job(NEW.influencer_id, NEW.deliverable_url);
  PERFORM public.enqueue_creator_media_job(NEW.influencer_id, NEW.delivery_proof_url);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'queue_application_collab_media: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proposals_queue_collab_media ON public.proposals;
CREATE TRIGGER trg_proposals_queue_collab_media
  AFTER INSERT OR UPDATE OF published_post_url, delivery_proof_url ON public.proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_proposal_collab_media();

DROP TRIGGER IF EXISTS trg_campaign_applications_queue_collab_media ON public.campaign_applications;
CREATE TRIGGER trg_campaign_applications_queue_collab_media
  AFTER INSERT OR UPDATE OF deliverable_url, delivery_proof_url ON public.campaign_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_application_collab_media();