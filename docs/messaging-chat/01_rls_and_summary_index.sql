-- Βήμα 1. Τρέξτε το ΜΕΤΑ το deploy.
-- Κλείνει ανάγνωση/εγγραφή συνομιλιών και μηνυμάτων στον συμμετέχοντα.
-- Το service role (API, cron) παρακάμπτει το RLS.
-- Idempotent. Rollback: 99_rollback.sql
--
-- Όλο το αρχείο είναι ένα transaction.

BEGIN;
SET LOCAL lock_timeout = '15s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS email_sent boolean DEFAULT false;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_messages_unread_unsent
  ON public.messages (created_at)
  WHERE read = false AND email_sent = false;

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influencer_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_presence ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('conversations', 'messages', 'influencer_presence', 'brand_presence')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

GRANT SELECT, UPDATE ON public.conversations TO authenticated;
GRANT SELECT, UPDATE ON public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.influencer_presence TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.brand_presence TO authenticated;
REVOKE INSERT ON public.messages FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.conversations FROM anon;
REVOKE ALL ON public.conversations FROM anon;
REVOKE ALL ON public.messages FROM anon;
REVOKE ALL ON public.influencer_presence FROM anon;
REVOKE ALL ON public.brand_presence FROM anon;

-- Συμμετέχων: influencer (id ή influencer_private) ή brand (email JWT ή brand_private).
CREATE POLICY conversations_select ON public.conversations
  FOR SELECT TO authenticated
  USING (
    influencer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.influencer_private p
      WHERE p.influencer_id = conversations.influencer_id
        AND (
          p.auth_user_id = auth.uid()
          OR lower(coalesce(p.contact_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
    OR lower(coalesce(brand_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
    OR EXISTS (
      SELECT 1 FROM public.brand_private b
      WHERE b.brand_id = auth.uid()
        AND lower(coalesce(b.contact_email, '')) = lower(coalesce(conversations.brand_email, ''))
    )
  );

CREATE POLICY conversations_update ON public.conversations
  FOR UPDATE TO authenticated
  USING (
    influencer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.influencer_private p
      WHERE p.influencer_id = conversations.influencer_id
        AND (
          p.auth_user_id = auth.uid()
          OR lower(coalesce(p.contact_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
    OR lower(coalesce(brand_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
    OR EXISTS (
      SELECT 1 FROM public.brand_private b
      WHERE b.brand_id = auth.uid()
        AND lower(coalesce(b.contact_email, '')) = lower(coalesce(conversations.brand_email, ''))
    )
  )
  WITH CHECK (
    influencer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.influencer_private p
      WHERE p.influencer_id = conversations.influencer_id
        AND (
          p.auth_user_id = auth.uid()
          OR lower(coalesce(p.contact_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
    OR lower(coalesce(brand_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
    OR EXISTS (
      SELECT 1 FROM public.brand_private b
      WHERE b.brand_id = auth.uid()
        AND lower(coalesce(b.contact_email, '')) = lower(coalesce(conversations.brand_email, ''))
    )
  );

CREATE POLICY messages_select ON public.messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (
          c.influencer_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.influencer_private p
            WHERE p.influencer_id = c.influencer_id
              AND (
                p.auth_user_id = auth.uid()
                OR lower(coalesce(p.contact_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
              )
          )
          OR lower(coalesce(c.brand_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
          OR EXISTS (
            SELECT 1 FROM public.brand_private b
            WHERE b.brand_id = auth.uid()
              AND lower(coalesce(b.contact_email, '')) = lower(coalesce(c.brand_email, ''))
          )
        )
    )
  );

-- Μόνο ο παραλήπτης αλλάζει read. Το API (service role) γράφει τα μηνύματα.
CREATE POLICY messages_mark_read ON public.messages
  FOR UPDATE TO authenticated
  USING (
    (
      sender_type = 'brand'
      AND (
        EXISTS (
          SELECT 1 FROM public.conversations c
          WHERE c.id = messages.conversation_id
            AND (
              c.influencer_id = auth.uid()
              OR EXISTS (
                SELECT 1 FROM public.influencer_private p
                WHERE p.influencer_id = c.influencer_id
                  AND (
                    p.auth_user_id = auth.uid()
                    OR lower(coalesce(p.contact_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
                  )
              )
            )
        )
      )
    )
    OR (
      sender_type = 'influencer'
      AND EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = messages.conversation_id
          AND (
            lower(coalesce(c.brand_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
            OR EXISTS (
              SELECT 1 FROM public.brand_private b
              WHERE b.brand_id = auth.uid()
                AND lower(coalesce(b.contact_email, '')) = lower(coalesce(c.brand_email, ''))
            )
          )
      )
    )
  )
  WITH CHECK (
    (
      sender_type = 'brand'
      AND EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = messages.conversation_id
          AND (
            c.influencer_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.influencer_private p
              WHERE p.influencer_id = c.influencer_id
                AND (
                  p.auth_user_id = auth.uid()
                  OR lower(coalesce(p.contact_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
                )
            )
          )
      )
    )
    OR (
      sender_type = 'influencer'
      AND EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = messages.conversation_id
          AND (
            lower(coalesce(c.brand_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
            OR EXISTS (
              SELECT 1 FROM public.brand_private b
              WHERE b.brand_id = auth.uid()
                AND lower(coalesce(b.contact_email, '')) = lower(coalesce(c.brand_email, ''))
            )
          )
      )
    )
  );

CREATE OR REPLACE FUNCTION public.guard_message_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.sender_type IS DISTINCT FROM OLD.sender_type
     OR NEW.content IS DISTINCT FROM OLD.content
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'message content is immutable';
  END IF;
  IF coalesce(auth.role(), '') IS DISTINCT FROM 'service_role' THEN
    NEW.email_sent := OLD.email_sent;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_message_update ON public.messages;
CREATE TRIGGER guard_message_update
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_message_update();

CREATE OR REPLACE FUNCTION public.guard_conversation_parties()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.influencer_id IS DISTINCT FROM OLD.influencer_id
     OR lower(coalesce(NEW.brand_email, '')) IS DISTINCT FROM lower(coalesce(OLD.brand_email, ''))
  THEN
    RAISE EXCEPTION 'conversation parties are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_conversation_parties ON public.conversations;
CREATE TRIGGER guard_conversation_parties
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_conversation_parties();

CREATE POLICY influencer_presence_select ON public.influencer_presence
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY influencer_presence_insert ON public.influencer_presence
  FOR INSERT TO authenticated
  WITH CHECK (
    influencer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.influencer_private p
      WHERE p.influencer_id = influencer_presence.influencer_id
        AND (
          p.auth_user_id = auth.uid()
          OR lower(coalesce(p.contact_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
  );

CREATE POLICY influencer_presence_update ON public.influencer_presence
  FOR UPDATE TO authenticated
  USING (
    influencer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.influencer_private p
      WHERE p.influencer_id = influencer_presence.influencer_id
        AND (
          p.auth_user_id = auth.uid()
          OR lower(coalesce(p.contact_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
  )
  WITH CHECK (
    influencer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.influencer_private p
      WHERE p.influencer_id = influencer_presence.influencer_id
        AND (
          p.auth_user_id = auth.uid()
          OR lower(coalesce(p.contact_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
  );

CREATE POLICY brand_presence_select ON public.brand_presence
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY brand_presence_insert ON public.brand_presence
  FOR INSERT TO authenticated
  WITH CHECK (
    lower(brand_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    OR EXISTS (
      SELECT 1 FROM public.brand_private b
      WHERE b.brand_id = auth.uid()
        AND lower(coalesce(b.contact_email, '')) = lower(brand_presence.brand_email)
    )
  );

CREATE POLICY brand_presence_update ON public.brand_presence
  FOR UPDATE TO authenticated
  USING (
    lower(brand_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    OR EXISTS (
      SELECT 1 FROM public.brand_private b
      WHERE b.brand_id = auth.uid()
        AND lower(coalesce(b.contact_email, '')) = lower(brand_presence.brand_email)
    )
  )
  WITH CHECK (
    lower(brand_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    OR EXISTS (
      SELECT 1 FROM public.brand_private b
      WHERE b.brand_id = auth.uid()
        AND lower(coalesce(b.contact_email, '')) = lower(brand_presence.brand_email)
    )
  );

COMMIT;
