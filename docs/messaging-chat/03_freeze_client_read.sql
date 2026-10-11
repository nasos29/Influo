-- Μετά το deploy: ο browser ρόλος δεν μπορεί πλέον να αλλάξει messages.read.
-- Το /api/messages/read (service role) είναι το μόνο που το θέτει, και μόνο για τα
-- μηνύματα του άλλου μέρους, όταν ο παραλήπτης έχει ανοιχτό το νήμα.
-- Το 99_rollback σβήνει αυτή τη συνάρτηση μαζί με το trigger του 01.

BEGIN;
SET LOCAL lock_timeout = '15s';
SET LOCAL statement_timeout = '120s';

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
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
