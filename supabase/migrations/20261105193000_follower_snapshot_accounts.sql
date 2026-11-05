-- Applied to Supabase 2026-11-05 (approved).
alter table public.influencer_follower_snapshots
  add column if not exists accounts jsonb;
