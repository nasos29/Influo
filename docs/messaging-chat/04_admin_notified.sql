-- Μετά το deploy: ξεχωριστό σημάδι ότι ο admin ειδοποιήθηκε για το μήνυμα.
-- Δεν πειράζει το email_sent (αυτό είναι η σύνοψη προς influencer/brand).
-- Τα μηνύματα που υπάρχουν ήδη σημειώνονται ως ειδοποιημένα, ώστε να μην ξανασταλεί όλο το ιστορικό.
-- Η συνάρτηση κρατάει και το πάγωμα του read από το 03. Μόνο το service role αλλάζει admin_notified.

BEGIN;
SET LOCAL lock_timeout = '15s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS admin_notified boolean DEFAULT false;

UPDATE public.messages
SET admin_notified = true
WHERE admin_notified IS DISTINCT FROM true
  AND created_at < now();

CREATE INDEX IF NOT EXISTS idx_messages_admin_unnotified
  ON public.messages (created_at)
  WHERE admin_notified = false;

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
    NEW.read := OLD.read;
    NEW.admin_notified := OLD.admin_notified;
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
