-- Temporary homepage Top 10 pin with automatic expiry.
-- When top10_boost_until > now(), the influencer is force-included in Top 10.
-- After expiry the column is ignored and organic ranking applies.

alter table public.influencers
  add column if not exists top10_boost_until timestamptz;

comment on column public.influencers.top10_boost_until is
  'When set in the future, force-include this influencer in homepage Top 10 until this timestamp (Athens/UTC). Null or past = no boost.';

create index if not exists influencers_top10_boost_until_idx
  on public.influencers (top10_boost_until)
  where top10_boost_until is not null;
