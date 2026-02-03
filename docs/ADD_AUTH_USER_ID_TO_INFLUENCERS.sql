-- Προσθήκη auth_user_id στον πίνακα influencers
-- Χρειάζεται για ανακοινώσεις (target_influencer_id = UUID από auth.users).
-- Τρέξε στο Supabase → SQL Editor.

ALTER TABLE influencers
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN influencers.auth_user_id IS 'UUID από auth.users(id) για ανακοινώσεις και RLS.';

-- (Προαιρετικό) Γέμισμα από auth.users αν το contact_email ταιριάζει με auth.users.email
UPDATE influencers i
SET auth_user_id = u.id
FROM auth.users u
WHERE i.contact_email IS NOT NULL
  AND LOWER(TRIM(i.contact_email)) = LOWER(TRIM(u.email::text))
  AND i.auth_user_id IS NULL;

-- Έλεγχος
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'influencers' AND column_name = 'auth_user_id';
