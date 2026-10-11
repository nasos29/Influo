-- Βήμα 3 από 3. Τρέξτε το ΑΜΕΣΩΣ ΜΕΤΑ το deploy του PR (το βήμα 2).
-- Αντικαθιστά το docs/RESTRICT_PUBLIC_INFLUENCER_COLUMNS.sql.
--
-- Κλείνει την ανάγνωση ιδιωτικών στηλών από anon ΚΑΙ authenticated.
-- Το service_role (API, cron, AuditPro μέσω /api/cron/...) ΔΕΝ πειράζεται:
-- παρακάμπτει το RLS και κρατά όλα τα δικαιώματα στηλών.
--
-- Οι στήλες ΔΕΝ σβήνονται. Τα scripts που γράφουν followers/approved/accounts
-- στον πίνακα influencers συνεχίζουν να δουλεύουν.
--
-- Νέα στήλη στον influencers δεν είναι αυτόματα ορατή στον browser, γιατί
-- το SELECT ξαναδίνεται μόνο στην παρακάτω λίστα (live schema, χωρίς τις
-- ιδιωτικές). Αν προσθέσετε δημόσια στήλη, βάλτε την στη λίστα και ξανατρέξτε.
--
-- Δεν σβήνει τις πολιτικές:
--   "Influencers are viewable by everyone"
--   "Influencers can update their own profile"
--   "Users can insert their own influencer profile"
--   "Influencers can delete their own profile"
--   "Influencer reviews are viewable by everyone"
--   "Authenticated users can insert reviews"
--   "Brands are viewable by everyone" / "Public read verified brands" / "Brands can view own data"
--
-- Όλο το αρχείο είναι ένα transaction.

BEGIN;
SET LOCAL lock_timeout = '15s';
SET LOCAL statement_timeout = '60s';

DO $$
DECLARE
  public_cols text[] := ARRAY[
    'id',
    'created_at',
    'display_name',
    'gender',
    'bio',
    'category',
    'location',
    'languages',
    'engagement_rate',
    'avg_likes',
    'audience_male_percent',
    'audience_female_percent',
    'audience_top_age',
    'accounts',
    'avatar_url',
    'verified',
    'videos',
    'avg_rating',
    'total_reviews',
    'avg_response_time',
    'completion_rate',
    'availability_status',
    'skills',
    'certifications',
    'approved',
    'analytics_verified',
    'approved_at',
    'analytics_verified_at',
    'video_thumbnails',
    'bio_en',
    'last_social_refresh_at',
    'auditpr_audit',
    'brands_notified_at',
    'profile_slug'
  ];
  private_cols text[] := ARRAY[
    'contact_email',
    'min_rate',
    'insights_urls',
    'service_packages',
    'approval_notes',
    'analytics_verification_notes',
    'auth_user_id',
    'birth_date',
    'rate_card'
  ];
  existing text[];
  granted text[] := ARRAY[]::text[];
  col text;
BEGIN
  SELECT COALESCE(array_agg(column_name::text), ARRAY[]::text[])
    INTO existing
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'influencers';

  IF existing IS NULL OR array_length(existing, 1) IS NULL THEN
    RAISE NOTICE 'Table public.influencers not found; skip.';
    RETURN;
  END IF;

  EXECUTE 'REVOKE SELECT ON TABLE public.influencers FROM PUBLIC, anon, authenticated';

  FOREACH col IN ARRAY public_cols LOOP
    IF col = ANY (existing) THEN
      granted := array_append(granted, format('%I', col));
    END IF;
  END LOOP;

  IF array_length(granted, 1) IS NOT NULL THEN
    EXECUTE format(
      'GRANT SELECT (%s) ON TABLE public.influencers TO anon, authenticated',
      array_to_string(granted, ', ')
    );
  END IF;

  FOREACH col IN ARRAY existing LOOP
    IF NOT (col = ANY (public_cols)) AND NOT (col = ANY (private_cols)) THEN
      RAISE NOTICE 'influencers.% was not granted to anon/authenticated (not in the public allow-list)', col;
    END IF;
  END LOOP;
END $$;

-- Brands: ό,τι δεν είναι email / ΑΦΜ μένει αναγνώσιμο. Το contact_email
-- το διαβάζει η ίδια η επιχείρηση από brand_private.
DO $$
DECLARE
  denied text[] := ARRAY['contact_email', 'email', 'afm', 'phone', 'password'];
  granted text[] := ARRAY[]::text[];
  col text;
  existing text[];
BEGIN
  SELECT COALESCE(array_agg(column_name::text), ARRAY[]::text[])
    INTO existing
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'brands';

  IF existing IS NULL OR array_length(existing, 1) IS NULL THEN
    RAISE NOTICE 'Table public.brands not found; skip.';
    RETURN;
  END IF;

  EXECUTE 'REVOKE SELECT ON TABLE public.brands FROM PUBLIC, anon, authenticated';

  FOREACH col IN ARRAY existing LOOP
    IF NOT (col = ANY (denied)) THEN
      granted := array_append(granted, format('%I', col));
    END IF;
  END LOOP;

  IF array_length(granted, 1) IS NOT NULL THEN
    EXECUTE format(
      'GRANT SELECT (%s) ON TABLE public.brands TO anon, authenticated',
      array_to_string(granted, ', ')
    );
  END IF;
END $$;

-- Δημόσιες κριτικές: χωρίς email επιχείρησης για anon και authenticated.
DO $$
DECLARE
  granted text[] := ARRAY[]::text[];
  col text;
  existing text[];
BEGIN
  SELECT COALESCE(array_agg(column_name::text), ARRAY[]::text[])
    INTO existing
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'influencer_reviews';

  IF existing IS NULL OR array_length(existing, 1) IS NULL THEN
    RAISE NOTICE 'Table public.influencer_reviews not found; skip.';
    RETURN;
  END IF;

  EXECUTE 'REVOKE SELECT ON TABLE public.influencer_reviews FROM PUBLIC, anon, authenticated';

  FOREACH col IN ARRAY existing LOOP
    IF col <> 'brand_email' THEN
      granted := array_append(granted, format('%I', col));
    END IF;
  END LOOP;

  IF array_length(granted, 1) IS NOT NULL THEN
    EXECUTE format(
      'GRANT SELECT (%s) ON TABLE public.influencer_reviews TO anon, authenticated',
      array_to_string(granted, ', ')
    );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
