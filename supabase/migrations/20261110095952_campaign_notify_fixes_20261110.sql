-- Campaign notification fixes (2026-11-10): durable publish dedupe, pending-apps reminder stamp,
-- atomic accept-with-slots RPC. Additive only (new table/column/function; no drops).

-- Q3: one durable claim per (campaign, opening, channel) across processes/restarts.
create table if not exists public.campaign_notify_log (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.brand_campaigns(id) on delete cascade,
  opened_at timestamptz not null,
  channel text not null,
  created_at timestamptz not null default now(),
  constraint campaign_notify_log_channel_check check (char_length(channel) between 1 and 64),
  constraint campaign_notify_log_unique unique (campaign_id, opened_at, channel)
);

create index if not exists campaign_notify_log_campaign_idx
  on public.campaign_notify_log (campaign_id, created_at desc);

alter table public.campaign_notify_log enable row level security;
-- No policies: service role only (server notify paths).

-- Q5: stamp so brand unanswered-application reminders fire at most once every 3 days per campaign.
alter table public.brand_campaigns
  add column if not exists pending_apps_reminder_sent_at timestamptz;

-- Q2: race-safe accept — lock campaign row, count accepted, update only if a slot remains.
create or replace function public.try_accept_campaign_application(
  p_application_id uuid,
  p_brand_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
  v_brand_id uuid;
  v_status text;
  v_slots integer;
  v_filled integer;
begin
  if p_application_id is null or p_brand_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_request');
  end if;

  select ca.campaign_id, ca.status, bc.brand_id, bc.slots
    into v_campaign_id, v_status, v_brand_id, v_slots
  from public.campaign_applications ca
  join public.brand_campaigns bc on bc.id = ca.campaign_id
  where ca.id = p_application_id
  for update of ca, bc;

  if v_campaign_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_brand_id is distinct from p_brand_user_id then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if v_status = 'accepted' then
    return jsonb_build_object('ok', true, 'already', true, 'status', 'accepted');
  end if;

  if v_status = 'withdrawn' then
    return jsonb_build_object('ok', false, 'error', 'withdrawn');
  end if;

  select count(*)::integer into v_filled
  from public.campaign_applications
  where campaign_id = v_campaign_id
    and status = 'accepted';

  if v_slots is not null and v_slots > 0 and v_filled >= v_slots then
    return jsonb_build_object('ok', false, 'error', 'slots_full', 'filled', v_filled, 'slots', v_slots);
  end if;

  update public.campaign_applications
  set status = 'accepted',
      reviewed_at = now()
  where id = p_application_id
    and status is distinct from 'accepted';

  if not found then
    return jsonb_build_object('ok', false, 'error', 'update_failed');
  end if;

  return jsonb_build_object('ok', true, 'already', false, 'status', 'accepted');
end;
$$;

revoke all on function public.try_accept_campaign_application(uuid, uuid) from public;
grant execute on function public.try_accept_campaign_application(uuid, uuid) to service_role;
