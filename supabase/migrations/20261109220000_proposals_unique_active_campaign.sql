-- One active (pending/accepted) campaign proposal per brand + creator + service_type.
-- Scoped to Καμπάνια:/Campaign: labels so direct package offers stay unrestricted.
-- Safe after cleanup of known duplicate accepted rows (57/58).

create unique index if not exists proposals_one_active_campaign_per_brand_influencer
  on public.proposals (brand_id, influencer_id, service_type)
  where status in ('pending', 'accepted')
    and brand_id is not null
    and service_type ~ '^(Καμπάνια|Campaign):';

comment on index public.proposals_one_active_campaign_per_brand_influencer is
  'Prevents double-submit duplicate campaign proposals (accept/invite) for the same brand+creator+campaign label.';
