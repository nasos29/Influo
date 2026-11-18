-- User reports (profiles + chat). Additive only; NOT applied in this PR.

CREATE TABLE IF NOT EXISTS public.user_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id uuid NOT NULL REFERENCES auth.users (id),
  reporter_role text NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  reason text NOT NULL,
  comment text,
  context text NOT NULL DEFAULT 'profile',
  conversation_id uuid,
  status text NOT NULL DEFAULT 'new',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_reports_reporter_role_check CHECK (reporter_role IN ('creator', 'brand', 'admin')),
  CONSTRAINT user_reports_target_type_check CHECK (target_type IN ('creator', 'brand')),
  CONSTRAINT user_reports_reason_check CHECK (
    reason IN (
      'fake_profile',
      'fake_stats',
      'inappropriate',
      'spam_fraud',
      'harassment',
      'broke_agreement',
      'other'
    )
  ),
  CONSTRAINT user_reports_context_check CHECK (context IN ('profile', 'chat')),
  CONSTRAINT user_reports_status_check CHECK (status IN ('new', 'in_review', 'closed'))
);

COMMENT ON TABLE public.user_reports IS 'Logged-in user reports against creators or brands (admin triage).';

CREATE UNIQUE INDEX IF NOT EXISTS user_reports_open_per_reporter_target
  ON public.user_reports (reporter_user_id, target_type, target_id)
  WHERE status IN ('new', 'in_review');

CREATE INDEX IF NOT EXISTS user_reports_status_created_idx
  ON public.user_reports (status, created_at DESC);

ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_reports FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS user_reports_insert_own ON public.user_reports;
CREATE POLICY user_reports_insert_own
  ON public.user_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (reporter_user_id = auth.uid());

GRANT INSERT ON TABLE public.user_reports TO authenticated;
GRANT ALL ON TABLE public.user_reports TO service_role;