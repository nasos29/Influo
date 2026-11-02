-- Rollback for docs/SUPPORT_TICKET_MESSAGES.sql
-- Drops the thread table only. support_tickets columns stay, including message and admin_reply.

UPDATE public.support_tickets SET status = 'resolved' WHERE status = 'answered';
UPDATE public.support_tickets SET status = 'open' WHERE status = 'awaiting';

DROP POLICY IF EXISTS "Users read messages on their tickets" ON public.support_ticket_messages;
DROP TABLE IF EXISTS public.support_ticket_messages;

ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_status_check;
ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_status_check
  CHECK (status IN ('open', 'in_progress', 'resolved', 'closed'));
