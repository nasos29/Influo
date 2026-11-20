-- Deal cancel / proposal withdraw write status = 'cancelled', but the status CHECKs never allowed it,
-- so every cancel failed with a 500. Widen both checks (existing rows stay valid; nothing is removed).

alter table public.proposals drop constraint if exists proposals_status_check;
alter table public.proposals
  add constraint proposals_status_check
  check (status = any (array['pending', 'accepted', 'rejected', 'completed', 'cancelled']));

alter table public.campaign_applications drop constraint if exists campaign_applications_status_check;
alter table public.campaign_applications
  add constraint campaign_applications_status_check
  check (status = any (array['pending', 'withdrawn', 'shortlisted', 'rejected', 'accepted', 'cancelled']));
