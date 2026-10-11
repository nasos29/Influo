-- Κλείσιμο της δημόσιας ανάγνωσης προσωπικών στηλών στον πίνακα influencers.
-- Τρέξτε το στο Supabase → SQL Editor (μία φορά).
--
-- Το site (Next.js) σταματάει να στέλνει αυτά τα πεδία από το API.
-- Αυτό το SQL χρειάζεται επιπλέον, γιατί το κλειδί anon του browser μπορεί
-- ακόμα να διαβάσει όλον τον πίνακα: η πολιτική RLS λέει USING (true),
-- δηλαδή «όλες οι γραμμές», και δεν κρύβει στήλες.
--
-- Το service_role (τα API routes του server) παρακάμπτει το RLS.
-- Γι' αυτό το API πρέπει να έχει δική του λίστα επιτρεπτών πεδίων.
--
-- Ο ρόλος authenticated ΔΕΝ αλλάζει εδώ, ώστε dashboard / admin να συνεχίσουν
-- να διαβάζουν το δικό τους προφίλ. Ρίσκο που μένει: οποιοσδήποτε συνδεδεμένος
-- χρήστης (όχι μόνο επιχείρηση) μπορεί ακόμα, από την κονσόλα του browser,
-- να ζητήσει contact_email / birth_date / τιμές άλλων influencers, επειδή
-- η πολιτική SELECT είναι ανοιχτή σε όλους. Επόμενο βήμα (ξεχωριστό):
-- οι ιδιωτικές στήλες να διαβάζονται μόνο από server routes με έλεγχο ρόλου.

DO $$
DECLARE
  public_cols text[] := ARRAY[
    'id',
    'display_name',
    'bio',
    'bio_en',
    'avatar_url',
    'analytics_verified',
    'verified',
    'accounts',
    'category',
    'languages',
    'gender',
    'location',
    'avg_likes',
    'engagement_rate',
    'avg_rating',
    'total_reviews',
    'past_brands',
    'created_at',
    'availability_status',
    'profile_slug',
    'videos',
    'video_thumbnails',
    'skills',
    'certifications',
    'audience_male_percent',
    'audience_female_percent',
    'audience_top_age',
    'auditpr_audit',
    'avg_response_time',
    'completion_rate',
    'approved'
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

  EXECUTE 'REVOKE SELECT ON TABLE public.influencers FROM anon';

  FOREACH col IN ARRAY public_cols LOOP
    IF col = ANY (existing) THEN
      granted := array_append(granted, format('%I', col));
    END IF;
  END LOOP;

  IF array_length(granted, 1) IS NOT NULL THEN
    EXECUTE format(
      'GRANT SELECT (%s) ON TABLE public.influencers TO anon',
      array_to_string(granted, ', ')
    );
  END IF;
END $$;

-- Κατάλογος brands: το anon δεν χρειάζεται το email επικοινωνίας.
DO $$
DECLARE
  public_cols text[] := ARRAY[
    'id',
    'brand_name',
    'contact_person',
    'website',
    'industry',
    'logo_url',
    'verified',
    'created_at'
  ];
  existing text[];
  granted text[] := ARRAY[]::text[];
  col text;
BEGIN
  SELECT COALESCE(array_agg(column_name::text), ARRAY[]::text[])
    INTO existing
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'brands';

  IF existing IS NULL OR array_length(existing, 1) IS NULL THEN
    RAISE NOTICE 'Table public.brands not found; skip.';
    RETURN;
  END IF;

  EXECUTE 'REVOKE SELECT ON TABLE public.brands FROM anon';

  FOREACH col IN ARRAY public_cols LOOP
    IF col = ANY (existing) THEN
      granted := array_append(granted, format('%I', col));
    END IF;
  END LOOP;

  IF array_length(granted, 1) IS NOT NULL THEN
    EXECUTE format(
      'GRANT SELECT (%s) ON TABLE public.brands TO anon',
      array_to_string(granted, ', ')
    );
  END IF;
END $$;

-- Οι δημόσιες αξιολογήσεις δεν χρειάζεται να επιστρέφουν το email του brand.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'influencer_reviews' AND column_name = 'brand_email'
  ) THEN
    EXECUTE 'REVOKE SELECT (brand_email) ON TABLE public.influencer_reviews FROM anon';
  END IF;
END $$;
