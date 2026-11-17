-- Document semantics only (no schema change). Do NOT apply from this task.
-- showcase_admin_pinned = admin "Εμφάνιση στην αρχική" selection.
-- Public homepage: if any pinned rows have a valid video/post URL, show only those;
-- otherwise fall back to latest eligible with video. /collaborations lists all eligible with video.
-- Rows without a valid video never appear publicly (admin still lists them).

comment on column public.proposals.showcase_admin_pinned is
  'Admin: show this collaboration on the homepage (when it has a valid video/post URL). If none are pinned, homepage falls back to latest with video.';

comment on column public.campaign_applications.showcase_admin_pinned is
  'Admin: show this collaboration on the homepage (when it has a valid video/post URL). If none are pinned, homepage falls back to latest with video.';
