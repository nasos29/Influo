-- ============================================================
-- ΕΠΑΛΗΘΕΥΣΗ & ΡΥΘΜΙΣΗ ΑΝΑΚΟΙΝΩΣΕΩΝ ΣΤΟ SUPABASE
-- Τρέξε αυτό το script στο Supabase → SQL Editor.
-- ============================================================

-- 1) Τύπος influencers.id
SELECT
  'influencers.id type' AS check_name,
  (SELECT data_type FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'influencers' AND column_name = 'id') AS result;

-- 2) Υπάρχουν οι πίνακες ανακοινώσεων;
SELECT
  'announcements table exists' AS check_name,
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'announcements')::text AS result
UNION ALL
SELECT
  'announcement_reads table exists',
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'announcement_reads')::text;

-- 3) Τύπος target_influencer_id (αν υπάρχει ο πίνακας)
SELECT
  'announcements.target_influencer_id type' AS check_name,
  COALESCE(
    (SELECT data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'announcements' AND column_name = 'target_influencer_id'),
    'table_or_column_missing'
  ) AS result;

-- ============================================================
-- ΑΝ influencers.id = uuid → Τίποτα άλλο. Είσαι έτοιμος.
-- ΑΝ influencers.id = integer/bigint → Χρειάζεσαι auth_user_id.
-- ============================================================

-- 4) (Προαιρετικό) Προσθήκη auth_user_id αν το influencers.id ΔΕΝ είναι uuid
-- Ξε-σχολιάρε τα παρακάτω ΜΟΝΟ αν το (1) έδωσε integer/bigint.

/*
ALTER TABLE influencers
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN influencers.auth_user_id IS 'UUID από auth.users(id) για ανακοινώσεις και RLS.';
*/

-- 5) (Προαιρετικό) Έλεγχος αν υπάρχει ήδη auth_user_id
SELECT
  'influencers.auth_user_id exists' AS check_name,
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'influencers' AND column_name = 'auth_user_id')::text AS result;
