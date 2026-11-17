-- Admin 1:1 chat with any user (influencer or brand).
-- Additive: peer brand↔influencer threads unchanged. Do NOT apply to prod from the agent —
-- ship as a PR migration for ops to run.
--
-- conversation_kind = 'peer' (default) | 'admin'
-- admin threads: exactly one side set (influencer_id XOR brand_email).
-- messages.sender_type gains 'admin'.

BEGIN;
SET LOCAL lock_timeout = '15s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS conversation_kind text NOT NULL DEFAULT 'peer';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'conversations_kind_check'
      AND conrelid = 'public.conversations'::regclass
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_kind_check
      CHECK (conversation_kind IN ('peer', 'admin'));
  END IF;
END $$;

-- Allow admin-brand threads (no influencer) and admin-influencer (no brand email).
ALTER TABLE public.conversations ALTER COLUMN influencer_id DROP NOT NULL;
ALTER TABLE public.conversations ALTER COLUMN influencer_name DROP NOT NULL;
ALTER TABLE public.conversations ALTER COLUMN influencer_email DROP NOT NULL;
ALTER TABLE public.conversations ALTER COLUMN brand_email DROP NOT NULL;

ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_influencer_id_brand_email_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'conversations_admin_sides_check'
      AND conrelid = 'public.conversations'::regclass
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_admin_sides_check
      CHECK (
        (
          conversation_kind = 'peer'
          AND influencer_id IS NOT NULL
          AND brand_email IS NOT NULL
          AND length(btrim(brand_email)) > 0
        )
        OR (
          conversation_kind = 'admin'
          AND (
            (influencer_id IS NOT NULL AND (brand_email IS NULL OR btrim(brand_email) = ''))
            OR (influencer_id IS NULL AND brand_email IS NOT NULL AND length(btrim(brand_email)) > 0)
          )
        )
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_peer_pair_uidx
  ON public.conversations (influencer_id, lower(brand_email))
  WHERE conversation_kind = 'peer';

CREATE UNIQUE INDEX IF NOT EXISTS conversations_admin_influencer_uidx
  ON public.conversations (influencer_id)
  WHERE conversation_kind = 'admin' AND influencer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_admin_brand_uidx
  ON public.conversations (lower(brand_email))
  WHERE conversation_kind = 'admin' AND influencer_id IS NULL AND brand_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_kind_last_message
  ON public.conversations (conversation_kind, last_message_at DESC NULLS LAST);

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS last_activity_admin timestamptz;

COMMENT ON COLUMN public.conversations.conversation_kind IS
  'peer = brand↔influencer; admin = Influo staff 1:1 with one user.';
COMMENT ON COLUMN public.conversations.last_activity_admin IS
  'When admin last viewed/sent in an admin conversation (push skip).';

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_sender_type_check;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_sender_type_check
  CHECK (sender_type IN ('influencer', 'brand', 'admin'));

COMMIT;
