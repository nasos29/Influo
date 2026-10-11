-- Βήμα 1 από 3. Τρέξτε το ΠΡΩΤΑ, με το σημερινό site ακόμα στον αέρα.
-- Δεν αφαιρεί δικαιώματα και δεν σβήνει στήλες. Τα scrapers και το AuditPro
-- συνεχίζουν να διαβάζουν/γράφουν τον πίνακα influencers μέσω service role.
--
-- Μετά: deploy του PR. Αμέσως μετά: 02_revoke_browser_private_columns.sql.
-- Rollback: 99_rollback_private_tables.sql (μετά το 02, ή και μόνο του αν τρέξατε μόνο το 01).
--
-- Ιδιωτικές στήλες μένουν στον influencers για το service role (cron, admin API,
-- emails). Ο browser του συνδεδεμένου χρήστη θα τις διαβάζει μόνο από
-- influencer_private / brand_private, και μόνο τη δική του γραμμή (RLS).
--
-- Στήλες influencers όπως είναι στο live (project rljegispdrlvoyhnefuv):
-- id uuid. Ιδιωτικές που μένουν στον πίνακα για το service role:
-- contact_email, birth_date, auth_user_id, min_rate, rate_card,
-- service_packages, insights_urls, approval_notes, analytics_verification_notes.
-- Οι πολιτικές "Influencers are viewable by everyone",
-- "Influencers can update their own profile",
-- "Users can insert their own influencer profile",
-- "Influencers can delete their own profile" ΔΕΝ πειράζονται.
--
-- Όλο το αρχείο είναι ένα transaction. Αν κάτι αποτύχει, δεν μένει μισό.

BEGIN;
SET LOCAL lock_timeout = '15s';
SET LOCAL statement_timeout = '180s';

CREATE TABLE IF NOT EXISTS public.influencer_private (
  influencer_id uuid PRIMARY KEY REFERENCES public.influencers(id) ON DELETE CASCADE,
  contact_email text,
  birth_date date,
  auth_user_id uuid,
  min_rate text,
  rate_card jsonb,
  service_packages jsonb,
  insights_urls jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.brand_private (
  brand_id uuid PRIMARY KEY REFERENCES public.brands(id) ON DELETE CASCADE,
  contact_email text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.influencer_private ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_private ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.influencer_private FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.brand_private FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.influencer_private TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.brand_private TO authenticated;
GRANT ALL ON TABLE public.influencer_private TO service_role;
GRANT ALL ON TABLE public.brand_private TO service_role;

DROP POLICY IF EXISTS influencer_private_select ON public.influencer_private;
DROP POLICY IF EXISTS influencer_private_insert ON public.influencer_private;
DROP POLICY IF EXISTS influencer_private_update ON public.influencer_private;
DROP POLICY IF EXISTS brand_private_select ON public.brand_private;
DROP POLICY IF EXISTS brand_private_insert ON public.brand_private;
DROP POLICY IF EXISTS brand_private_update ON public.brand_private;

-- Μόνο η δική του γραμμή: id λογαριασμού, auth_user_id, ή το επιβεβαιωμένο email του JWT.
CREATE POLICY influencer_private_select ON public.influencer_private
  FOR SELECT TO authenticated
  USING (
    influencer_id = auth.uid()
    OR auth_user_id = auth.uid()
    OR lower(coalesce(contact_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

CREATE POLICY influencer_private_insert ON public.influencer_private
  FOR INSERT TO authenticated
  WITH CHECK (
    influencer_id = auth.uid()
    OR auth_user_id = auth.uid()
  );

CREATE POLICY influencer_private_update ON public.influencer_private
  FOR UPDATE TO authenticated
  USING (
    influencer_id = auth.uid()
    OR auth_user_id = auth.uid()
    OR lower(coalesce(contact_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  WITH CHECK (
    influencer_id = auth.uid()
    OR auth_user_id = auth.uid()
    OR lower(coalesce(contact_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

CREATE POLICY brand_private_select ON public.brand_private
  FOR SELECT TO authenticated
  USING (
    brand_id = auth.uid()
    OR lower(coalesce(contact_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

CREATE POLICY brand_private_insert ON public.brand_private
  FOR INSERT TO authenticated
  WITH CHECK (brand_id = auth.uid());

CREATE POLICY brand_private_update ON public.brand_private
  FOR UPDATE TO authenticated
  USING (
    brand_id = auth.uid()
    OR lower(coalesce(contact_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  WITH CHECK (
    brand_id = auth.uid()
    OR lower(coalesce(contact_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- Αντιγραφή ιδιωτικών πεδίων influencers → influencer_private.
-- Δεν κοιτάει notes προσωπικού (approval_notes): αυτά μένουν μόνο στον κύριο πίνακα.
CREATE OR REPLACE FUNCTION public.sync_influencer_private_from_public()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload jsonb := to_jsonb(NEW);
  birth date;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  BEGIN
    birth := NULLIF(payload ->> 'birth_date', '')::date;
  EXCEPTION WHEN others THEN
    birth := NULL;
  END;

  INSERT INTO public.influencer_private AS p (
    influencer_id, contact_email, birth_date, auth_user_id, min_rate,
    rate_card, service_packages, insights_urls, updated_at
  ) VALUES (
    NEW.id,
    NULLIF(payload ->> 'contact_email', ''),
    birth,
    NULLIF(payload ->> 'auth_user_id', '')::uuid,
    payload ->> 'min_rate',
    CASE WHEN payload ? 'rate_card' THEN payload -> 'rate_card' ELSE NULL END,
    CASE WHEN payload ? 'service_packages' THEN payload -> 'service_packages' ELSE NULL END,
    CASE WHEN payload ? 'insights_urls' THEN payload -> 'insights_urls' ELSE NULL END,
    now()
  )
  ON CONFLICT (influencer_id) DO UPDATE SET
    contact_email = EXCLUDED.contact_email,
    birth_date = EXCLUDED.birth_date,
    auth_user_id = EXCLUDED.auth_user_id,
    min_rate = EXCLUDED.min_rate,
    rate_card = EXCLUDED.rate_card,
    service_packages = EXCLUDED.service_packages,
    insights_urls = EXCLUDED.insights_urls,
    updated_at = now();

  RETURN NEW;
EXCEPTION WHEN invalid_text_representation THEN
  -- auth_user_id που δεν είναι uuid: γράψε τα υπόλοιπα χωρίς αυτό.
  INSERT INTO public.influencer_private AS p (
    influencer_id, contact_email, birth_date, min_rate,
    rate_card, service_packages, insights_urls, updated_at
  ) VALUES (
    NEW.id,
    NULLIF(payload ->> 'contact_email', ''),
    birth,
    payload ->> 'min_rate',
    CASE WHEN payload ? 'rate_card' THEN payload -> 'rate_card' ELSE NULL END,
    CASE WHEN payload ? 'service_packages' THEN payload -> 'service_packages' ELSE NULL END,
    CASE WHEN payload ? 'insights_urls' THEN payload -> 'insights_urls' ELSE NULL END,
    now()
  )
  ON CONFLICT (influencer_id) DO UPDATE SET
    contact_email = EXCLUDED.contact_email,
    birth_date = EXCLUDED.birth_date,
    min_rate = EXCLUDED.min_rate,
    rate_card = EXCLUDED.rate_card,
    service_packages = EXCLUDED.service_packages,
    insights_urls = EXCLUDED.insights_urls,
    updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_influencer_public_from_private()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  col text;
  dtype text;
  private_cols text[] := ARRAY[
    'contact_email', 'birth_date', 'auth_user_id', 'min_rate',
    'rate_card', 'service_packages', 'insights_urls'
  ];
  payload jsonb := to_jsonb(NEW);
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  FOREACH col IN ARRAY private_cols LOOP
    SELECT c.data_type INTO dtype
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'influencers' AND c.column_name = col;
    IF dtype IS NULL THEN
      CONTINUE;
    END IF;

    IF dtype = 'jsonb' OR dtype = 'json' THEN
      EXECUTE format('UPDATE public.influencers SET %I = $1 WHERE id = $2', col)
        USING payload -> col, NEW.influencer_id;
    ELSIF dtype = 'ARRAY' THEN
      EXECUTE format(
        'UPDATE public.influencers SET %I = ARRAY(SELECT jsonb_array_elements_text($1)) WHERE id = $2',
        col
      ) USING COALESCE(payload -> col, '[]'::jsonb), NEW.influencer_id;
    ELSIF dtype = 'date' THEN
      EXECUTE format(
        'UPDATE public.influencers SET %I = NULLIF($1, '''')::date WHERE id = $2',
        col
      ) USING payload ->> col, NEW.influencer_id;
    ELSIF dtype = 'uuid' THEN
      EXECUTE format(
        'UPDATE public.influencers SET %I = NULLIF($1, '''')::uuid WHERE id = $2',
        col
      ) USING payload ->> col, NEW.influencer_id;
    ELSE
      EXECUTE format('UPDATE public.influencers SET %I = $1 WHERE id = $2', col)
        USING payload ->> col, NEW.influencer_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_brand_private_from_public()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload jsonb := to_jsonb(NEW);
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.brand_private (brand_id, contact_email, updated_at)
  VALUES (NEW.id, NULLIF(payload ->> 'contact_email', ''), now())
  ON CONFLICT (brand_id) DO UPDATE SET
    contact_email = EXCLUDED.contact_email,
    updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_brand_public_from_private()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'brands' AND column_name = 'contact_email'
  ) THEN
    UPDATE public.brands
      SET contact_email = NEW.contact_email
      WHERE id = NEW.brand_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_influencer_private_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.influencer_private WHERE influencer_id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_brand_private_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.brand_private WHERE brand_id = OLD.id;
  RETURN OLD;
END;
$$;

-- Ναι/όχι αν υπάρχει λογαριασμός επιχείρησης, χωρίς να επιστρέφει το email.
CREATE OR REPLACE FUNCTION public.brand_account_exists(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.brands
    WHERE lower(trim(contact_email)) = lower(trim(coalesce(p_email, '')))
  );
$$;

REVOKE ALL ON FUNCTION public.brand_account_exists(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.brand_account_exists(text) TO authenticated, service_role;

-- Backfill πριν τους triggers αντίστροφης φοράς. Μία κακή ημερομηνία δεν σταματάει τις υπόλοιπες.
DO $$
DECLARE
  r record;
  birth date;
  auth_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'influencers'
  ) THEN
    RETURN;
  END IF;

  FOR r IN SELECT id AS influencer_id, to_jsonb(influencers.*) AS payload FROM public.influencers LOOP
    BEGIN
      birth := NULLIF(r.payload ->> 'birth_date', '')::date;
    EXCEPTION WHEN others THEN
      birth := NULL;
    END;
    BEGIN
      auth_id := NULLIF(r.payload ->> 'auth_user_id', '')::uuid;
    EXCEPTION WHEN others THEN
      auth_id := NULL;
    END;

    INSERT INTO public.influencer_private (
      influencer_id, contact_email, birth_date, auth_user_id, min_rate,
      rate_card, service_packages, insights_urls, updated_at
    ) VALUES (
      r.influencer_id,
      NULLIF(r.payload ->> 'contact_email', ''),
      birth,
      auth_id,
      r.payload ->> 'min_rate',
      CASE WHEN r.payload ? 'rate_card' THEN r.payload -> 'rate_card' ELSE NULL END,
      CASE WHEN r.payload ? 'service_packages' THEN r.payload -> 'service_packages' ELSE NULL END,
      CASE WHEN r.payload ? 'insights_urls' THEN r.payload -> 'insights_urls' ELSE NULL END,
      now()
    )
    ON CONFLICT (influencer_id) DO UPDATE SET
      contact_email = EXCLUDED.contact_email,
      birth_date = EXCLUDED.birth_date,
      auth_user_id = EXCLUDED.auth_user_id,
      min_rate = EXCLUDED.min_rate,
      rate_card = EXCLUDED.rate_card,
      service_packages = EXCLUDED.service_packages,
      insights_urls = EXCLUDED.insights_urls,
      updated_at = now();
  END LOOP;
END $$;

INSERT INTO public.brand_private (brand_id, contact_email, updated_at)
SELECT b.id, NULLIF(to_jsonb(b) ->> 'contact_email', ''), now()
FROM public.brands b
ON CONFLICT (brand_id) DO UPDATE SET
  contact_email = EXCLUDED.contact_email,
  updated_at = now();

-- Γέμισμα auth_user_id όπου λείπει, από το email του Auth.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'influencers' AND column_name = 'auth_user_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'influencers' AND column_name = 'contact_email'
  ) THEN
    RETURN;
  END IF;

  UPDATE public.influencers i
  SET auth_user_id = u.id
  FROM auth.users u
  WHERE i.auth_user_id IS NULL
    AND i.contact_email IS NOT NULL
    AND lower(trim(i.contact_email)) = lower(trim(u.email::text));

  UPDATE public.influencer_private p
  SET auth_user_id = i.auth_user_id
  FROM public.influencers i
  WHERE p.influencer_id = i.id
    AND i.auth_user_id IS NOT NULL
    AND p.auth_user_id IS DISTINCT FROM i.auth_user_id;
END $$;

DO $$
DECLARE
  cols text[] := ARRAY[]::text[];
  wanted text[] := ARRAY[
    'contact_email', 'birth_date', 'auth_user_id', 'min_rate',
    'rate_card', 'service_packages', 'insights_urls'
  ];
  col text;
BEGIN
  FOREACH col IN ARRAY wanted LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'influencers' AND column_name = col
    ) THEN
      cols := array_append(cols, format('%I', col));
    END IF;
  END LOOP;

  DROP TRIGGER IF EXISTS trg_sync_influencer_private ON public.influencers;
  IF array_length(cols, 1) IS NOT NULL THEN
    EXECUTE format(
      'CREATE TRIGGER trg_sync_influencer_private
       AFTER INSERT OR UPDATE OF %s ON public.influencers
       FOR EACH ROW EXECUTE FUNCTION public.sync_influencer_private_from_public()',
      array_to_string(cols, ', ')
    );
  END IF;

  DROP TRIGGER IF EXISTS trg_delete_influencer_private ON public.influencers;
  CREATE TRIGGER trg_delete_influencer_private
    AFTER DELETE ON public.influencers
    FOR EACH ROW EXECUTE FUNCTION public.delete_influencer_private_row();

  DROP TRIGGER IF EXISTS trg_sync_brand_private ON public.brands;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'brands' AND column_name = 'contact_email'
  ) THEN
    CREATE TRIGGER trg_sync_brand_private
      AFTER INSERT OR UPDATE OF contact_email ON public.brands
      FOR EACH ROW EXECUTE FUNCTION public.sync_brand_private_from_public();
  END IF;

  DROP TRIGGER IF EXISTS trg_delete_brand_private ON public.brands;
  CREATE TRIGGER trg_delete_brand_private
    AFTER DELETE ON public.brands
    FOR EACH ROW EXECUTE FUNCTION public.delete_brand_private_row();
END $$;

DROP TRIGGER IF EXISTS trg_sync_influencer_public ON public.influencer_private;
CREATE TRIGGER trg_sync_influencer_public
  AFTER INSERT OR UPDATE ON public.influencer_private
  FOR EACH ROW EXECUTE FUNCTION public.sync_influencer_public_from_private();

DROP TRIGGER IF EXISTS trg_sync_brand_public ON public.brand_private;
CREATE TRIGGER trg_sync_brand_public
  AFTER INSERT OR UPDATE ON public.brand_private
  FOR EACH ROW EXECUTE FUNCTION public.sync_brand_public_from_private();

-- Οι πολιτικές proposals/tickets διαβάζουν influencers.contact_email ή
-- brands.contact_email. Μετά το βήμα 02 ο browser δεν έχει SELECT σε αυτές
-- τις στήλες, οπότε οι παλιές εκφράσεις θα έσκαγαν. Ισοδύναμος έλεγχος
-- μέσω των private πινάκων (η κάθε επιχείρηση/influencer βλέπει μόνο τη δική της γραμμή).
DO $$
DECLARE
  using_expr text;
  has_brand_id boolean;
  ticket_check text := '(
    (user_type = ''influencer'' AND (
      user_id = auth.uid()::text
      OR user_id IN (
        SELECT p.influencer_id::text
        FROM public.influencer_private p
        WHERE p.influencer_id = auth.uid()
           OR p.auth_user_id = auth.uid()
           OR lower(coalesce(p.contact_email, '''')) = lower(coalesce((
             SELECT u.email::text FROM auth.users u WHERE u.id = auth.uid()
           ), ''''))
      )
    ))
    OR
    (user_type = ''brand'' AND lower(coalesce(user_email, '''')) = lower(coalesce((
      SELECT u.email::text FROM auth.users u WHERE u.id = auth.uid()
    ), '''')))
  )';
BEGIN
  IF to_regclass('public.proposals') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'proposals' AND column_name = 'brand_id'
    ) INTO has_brand_id;

    using_expr := 'EXISTS (
      SELECT 1 FROM public.brand_private bp
      WHERE bp.brand_id = auth.uid()
        AND lower(bp.contact_email) = lower(proposals.brand_email)
    )';
    IF has_brand_id THEN
      using_expr := '(proposals.brand_id = auth.uid()) OR ' || using_expr;
    END IF;

    EXECUTE 'DROP POLICY IF EXISTS "Brands can view their own proposals" ON public.proposals';
    EXECUTE 'DROP POLICY IF EXISTS "Brands can update their own proposals" ON public.proposals';
    EXECUTE format(
      'CREATE POLICY "Brands can view their own proposals" ON public.proposals FOR SELECT TO public USING (%s)',
      using_expr
    );
    EXECUTE format(
      'CREATE POLICY "Brands can update their own proposals" ON public.proposals FOR UPDATE TO public USING (%s) WITH CHECK (%s)',
      using_expr,
      using_expr
    );
  END IF;

  IF to_regclass('public.support_tickets') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view their own tickets" ON public.support_tickets';
    EXECUTE 'DROP POLICY IF EXISTS "Users can create tickets" ON public.support_tickets';
    EXECUTE format(
      'CREATE POLICY "Users can view their own tickets" ON public.support_tickets FOR SELECT TO public USING (%s)',
      ticket_check
    );
    EXECUTE format(
      'CREATE POLICY "Users can create tickets" ON public.support_tickets FOR INSERT TO public WITH CHECK (%s)',
      ticket_check
    );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
