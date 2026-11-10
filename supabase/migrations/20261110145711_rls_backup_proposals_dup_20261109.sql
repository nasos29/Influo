-- Lock down one-off backup table: RLS on, no policies for anon/authenticated.
-- Data is preserved; only service_role (and table owners) retain access.

ALTER TABLE public.backup_proposals_dup_20261109 ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.backup_proposals_dup_20261109 FROM PUBLIC, anon, authenticated;
