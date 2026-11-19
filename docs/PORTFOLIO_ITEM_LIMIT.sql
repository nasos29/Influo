-- Portfolio cap: 6 items (videos + photos). Additive trigger only; no data rewrite.
-- Creators already above 6 may keep or reduce their list, but cannot add more.
-- Apply on staging first; apply on production only at deploy with operator approval.

CREATE OR REPLACE FUNCTION public.enforce_portfolio_item_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  new_count integer;
  old_count integer;
  max_allowed constant integer := 6;
BEGIN
  new_count := CASE
    WHEN NEW.videos IS NULL OR jsonb_typeof(NEW.videos) <> 'array' THEN 0
    ELSE jsonb_array_length(NEW.videos)
  END;
  old_count := 0;
  IF TG_OP = 'UPDATE' THEN
    old_count := CASE
      WHEN OLD.videos IS NULL OR jsonb_typeof(OLD.videos) <> 'array' THEN 0
      ELSE jsonb_array_length(OLD.videos)
    END;
  END IF;

  IF new_count <= max_allowed THEN
    RETURN NEW;
  END IF;

  -- Grandfather existing longer lists; allow shrink or same length, block growth.
  IF TG_OP = 'UPDATE' AND new_count <= old_count THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Portfolio is limited to % items (videos and photos in total).', max_allowed
    USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_influencers_portfolio_item_limit ON public.influencers;
CREATE TRIGGER trg_influencers_portfolio_item_limit
  BEFORE INSERT OR UPDATE OF videos ON public.influencers
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_portfolio_item_limit();

COMMENT ON FUNCTION public.enforce_portfolio_item_limit() IS
  'Blocks new portfolio items beyond 6. Profiles already above 6 may only remove items.';
