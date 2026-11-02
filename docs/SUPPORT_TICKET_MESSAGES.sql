-- Support ticket reply thread.
-- Run once in the Supabase SQL editor. Do not delete the old columns.
-- Rollback: docs/SUPPORT_TICKET_MESSAGES_ROLLBACK.sql

CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'admin')),
  sender_id TEXT,
  body TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS support_ticket_messages_ticket_created_idx
  ON public.support_ticket_messages (ticket_id, created_at);

ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_status_check;
ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_status_check
  CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'answered', 'awaiting'));

-- Initial ticket text, then each appended "Νέα Απάντηση", then the current admin_reply.
INSERT INTO public.support_ticket_messages (ticket_id, sender_role, sender_id, body, attachments, created_at)
SELECT
  t.id,
  'user',
  t.user_id,
  part.body,
  CASE WHEN part.idx = 1 THEN COALESCE(t.attachments, '[]'::jsonb) ELSE '[]'::jsonb END,
  COALESCE(t.created_at, NOW()) + ((part.idx - 1) * INTERVAL '1 second')
FROM public.support_tickets t
CROSS JOIN LATERAL (
  SELECT
    ordinality::int AS idx,
    btrim(piece) AS body
  FROM unnest(string_to_array(COALESCE(t.message, ''), E'\n\n--- Νέα Απάντηση ---\n')) WITH ORDINALITY AS split(piece, ordinality)
) AS part
WHERE part.body <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.support_ticket_messages existing WHERE existing.ticket_id = t.id
  );

INSERT INTO public.support_ticket_messages (ticket_id, sender_role, sender_id, body, attachments, created_at)
SELECT
  t.id,
  'admin',
  NULL,
  btrim(t.admin_reply),
  COALESCE(t.admin_reply_attachments, '[]'::jsonb),
  COALESCE(t.admin_replied_at, t.updated_at, t.created_at, NOW())
FROM public.support_tickets t
WHERE t.admin_reply IS NOT NULL
  AND btrim(t.admin_reply) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.support_ticket_messages existing
    WHERE existing.ticket_id = t.id
      AND existing.sender_role = 'admin'
      AND existing.body = btrim(t.admin_reply)
  );

UPDATE public.support_tickets
SET status = CASE
  WHEN status = 'closed' THEN 'closed'
  WHEN status = 'resolved' OR (admin_reply IS NOT NULL AND btrim(admin_reply) <> '') THEN 'answered'
  WHEN position(E'\n\n--- Νέα Απάντηση ---\n' IN COALESCE(message, '')) > 0 THEN 'awaiting'
  WHEN status = 'in_progress' THEN 'open'
  ELSE status
END
WHERE status IN ('resolved', 'in_progress', 'open');

ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read messages on their tickets" ON public.support_ticket_messages;
CREATE POLICY "Users read messages on their tickets"
  ON public.support_ticket_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.support_tickets t
      WHERE t.id = support_ticket_messages.ticket_id
        AND (
          (
            t.user_type = 'influencer'
            AND t.user_id IN (
              SELECT id::TEXT
              FROM public.influencers
              WHERE contact_email = (SELECT email FROM auth.users WHERE id = auth.uid())
            )
          )
          OR (
            t.user_type = 'brand'
            AND t.user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
          )
        )
    )
  );

GRANT SELECT ON public.support_ticket_messages TO authenticated;
GRANT ALL ON public.support_ticket_messages TO service_role;
