-- Backfill public profile slugs. Run this yourself in the Supabase SQL editor.
-- It is not applied by the app, by migrations, or by this pull request.
--
-- Until a row has profile_slug, its canonical URL stays /influencer/<uuid>.
-- After this script, /influencer/<uuid> permanently redirects to /in/<slug>.
-- Existing slugs are left unchanged. The unique index from docs/ADD_PROFILE_SLUG.sql
-- must already exist.

BEGIN;

CREATE OR REPLACE FUNCTION public.influo_make_profile_slug(raw_name text, fallback_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v text;
  reserved text[] := ARRAY[
    'about','admin','api','blog','brand','brands','campaigns','contact','cookies',
    'dashboard','directory','docs','en','faq','for-brands','for-influencers','get-app',
    'help-desk','in','influencer','login','logout','messages','privacy','reset-password',
    'signup','terms','u','www'
  ];
BEGIN
  v := lower(coalesce(raw_name, ''));
  v := replace(v, 'θ', 'th');
  v := replace(v, 'χ', 'ch');
  v := replace(v, 'ψ', 'ps');
  v := translate(
    v,
    'αβγδεζηικλμνξοπρσςτυφωάέήίόύώϊϋΐΰ',
    'avgdeziiklmnxoprsstyfoaeiioyoiyiy'
  );
  v := regexp_replace(v, '[^a-z0-9]+', '-', 'g');
  v := regexp_replace(v, '(^-+|-+$)', '', 'g');
  v := left(v, 40);
  v := regexp_replace(v, '-+$', '', 'g');

  IF v IS NULL OR length(v) < 2 OR v = ANY (reserved) THEN
    v := 'creator-' || left(replace(fallback_id::text, '-', ''), 8);
  END IF;
  RETURN v;
END;
$$;

DO $$
DECLARE
  rec record;
  base text;
  candidate text;
  n int;
BEGIN
  FOR rec IN
    SELECT id, display_name
    FROM public.influencers
    WHERE profile_slug IS NULL OR btrim(profile_slug) = ''
    ORDER BY created_at NULLS LAST, id
  LOOP
    base := public.influo_make_profile_slug(rec.display_name, rec.id);
    candidate := base;
    n := 2;
    WHILE EXISTS (
      SELECT 1 FROM public.influencers
      WHERE profile_slug = candidate AND id <> rec.id
    ) LOOP
      candidate := left(base, 36) || '-' || n::text;
      n := n + 1;
      IF n > 80 THEN
        candidate := 'creator-' || left(replace(rec.id::text, '-', ''), 8);
        EXIT;
      END IF;
    END LOOP;

    UPDATE public.influencers
    SET profile_slug = candidate
    WHERE id = rec.id;
  END LOOP;
END $$;

DROP FUNCTION public.influo_make_profile_slug(text, uuid);

COMMIT;
