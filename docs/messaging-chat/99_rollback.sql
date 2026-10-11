-- Rollback του 01 (και ξε-προγραμματισμός του 02 αν υπάρχει).
-- Δεν σβήνει μηνύματα, συνομιλίες, ούτε τη στήλη email_sent.

BEGIN;
SET LOCAL lock_timeout = '15s';
SET LOCAL statement_timeout = '120s';

DROP TRIGGER IF EXISTS guard_message_update ON public.messages;
DROP TRIGGER IF EXISTS guard_conversation_parties ON public.conversations;
DROP FUNCTION IF EXISTS public.guard_message_update();
DROP FUNCTION IF EXISTS public.guard_conversation_parties();
DROP INDEX IF EXISTS public.idx_messages_unread_unsent;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('conversations', 'messages', 'influencer_presence', 'brand_presence')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.influencer_presence TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_presence TO authenticated;

CREATE POLICY "Allow all for authenticated users" ON public.conversations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON public.messages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON public.influencer_presence
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON public.brand_presence
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMIT;

-- Ξεχωριστά, αν τρέξατε το 02:
-- SELECT cron.unschedule('influo-message-summary');
